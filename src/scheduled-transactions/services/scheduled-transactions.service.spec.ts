import { ConflictException, BadRequestException } from '@nestjs/common';
import { ScheduledTransactionsService } from './scheduled-transactions.service';
import { ScheduledTransactionEntity } from '../../core/entities/scheduled-transaction.entity';
import * as dateUtils from '../../core/utils/date';

function makeScheduled(overrides: Partial<ScheduledTransactionEntity> = {}): ScheduledTransactionEntity {
  return new ScheduledTransactionEntity({
    id: 'sch-1',
    workspaceId: 'ws-1',
    bankAccountId: 'acc-1',
    amount: 10000,
    type: 'expense',
    description: 'Aluguel',
    category: 'housing',
    frequency: 'monthly',
    nextDate: '2024-01-31',
    endDate: null,
    dayOfMonth: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('ScheduledTransactionsService', () => {
  let scheduledRepo: any;
  let bankAccountRepo: any;
  let transactionRepo: any;
  let notifications: any;
  let db: any;
  let service: ScheduledTransactionsService;

  beforeEach(() => {
    scheduledRepo = {
      findById: jest.fn(),
      findDue: jest.fn(),
      claimOccurrence: jest.fn().mockResolvedValue(true),
      update: jest.fn(),
    };
    bankAccountRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'acc-1' }),
      updateBalance: jest.fn(),
    };
    transactionRepo = { create: jest.fn() };
    notifications = {
      notifyWorkspace: jest.fn(),
      sendScheduledTransactionExecuted: jest.fn(),
    };
    db = { transaction: jest.fn(async (cb: (trx: any) => Promise<unknown>) => cb(db)) };

    service = new ScheduledTransactionsService(
      scheduledRepo,
      bankAccountRepo,
      transactionRepo,
      db,
      notifications,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('execute lança a ocorrência e avança mensal sem transbordar o mês', async () => {
    scheduledRepo.findById.mockResolvedValue(makeScheduled());

    const next = await service.execute('sch-1', 'ws-1');

    expect(scheduledRepo.claimOccurrence).toHaveBeenCalledWith('sch-1', '2024-01-31', '2024-02-29', db);
    expect(transactionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10000, type: 'expense', date: '2024-01-31' }),
      db,
    );
    expect(bankAccountRepo.updateBalance).toHaveBeenCalledWith('acc-1', -10000, db);
    expect(next?.nextDate).toBe('2024-02-29');
  });

  it('execute volta ao dia âncora depois de um mês curto', async () => {
    scheduledRepo.findById.mockResolvedValue(
      makeScheduled({ nextDate: '2024-02-29', dayOfMonth: 31 }),
    );

    const next = await service.execute('sch-1', 'ws-1');

    expect(scheduledRepo.claimOccurrence).toHaveBeenCalledWith('sch-1', '2024-02-29', '2024-03-31', db);
    expect(next?.nextDate).toBe('2024-03-31');
  });

  it('create guarda o dia âncora de recorrências mensais', async () => {
    scheduledRepo.create = jest.fn().mockResolvedValue({});

    await service.create(
      {
        bankAccountId: 'acc-1',
        amount: 10,
        type: 'expense',
        category: 'housing',
        frequency: 'monthly',
        nextDate: '2024-01-31',
      },
      'ws-1',
    );

    expect(scheduledRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ dayOfMonth: 31, amount: 1000 }),
    );
  });

  it('execute encerra o agendamento quando a próxima data passa do término', async () => {
    scheduledRepo.findById.mockResolvedValue(
      makeScheduled({ nextDate: '2024-03-10', endDate: '2024-03-31' }),
    );

    const next = await service.execute('sch-1', 'ws-1');

    expect(scheduledRepo.claimOccurrence).toHaveBeenCalledWith('sch-1', '2024-03-10', null, db);
    expect(next).toBeNull();
  });

  it('execute não lança em dobro se a ocorrência já foi processada', async () => {
    scheduledRepo.findById.mockResolvedValue(makeScheduled());
    scheduledRepo.claimOccurrence.mockResolvedValue(false);

    await expect(service.execute('sch-1', 'ws-1')).rejects.toBeInstanceOf(ConflictException);
    expect(transactionRepo.create).not.toHaveBeenCalled();
    expect(bankAccountRepo.updateBalance).not.toHaveBeenCalled();
  });

  it('cron executa todas as ocorrências atrasadas até hoje', async () => {
    jest.spyOn(dateUtils, 'todayISO').mockReturnValue('2024-01-10');
    scheduledRepo.findDue.mockResolvedValue([
      makeScheduled({ frequency: 'daily', nextDate: '2024-01-08' }),
    ]);

    await service.handleDueTransactions();

    const dates = transactionRepo.create.mock.calls.map((c: any[]) => c[0].date);
    expect(dates).toEqual(['2024-01-08', '2024-01-09', '2024-01-10']);
    expect(notifications.notifyWorkspace).toHaveBeenCalledTimes(1);
  });

  it('cron respeita a data de término no catch-up', async () => {
    jest.spyOn(dateUtils, 'todayISO').mockReturnValue('2024-01-10');
    scheduledRepo.findDue.mockResolvedValue([
      makeScheduled({ frequency: 'daily', nextDate: '2024-01-08', endDate: '2024-01-09' }),
    ]);

    await service.handleDueTransactions();

    const dates = transactionRepo.create.mock.calls.map((c: any[]) => c[0].date);
    expect(dates).toEqual(['2024-01-08', '2024-01-09']);
    expect(scheduledRepo.claimOccurrence).toHaveBeenLastCalledWith('sch-1', '2024-01-09', null, db);
  });

  it('create rejeita término anterior à próxima data', async () => {
    await expect(
      service.create(
        {
          bankAccountId: 'acc-1',
          amount: 10,
          type: 'expense',
          category: 'housing',
          frequency: 'monthly',
          nextDate: '2024-02-01',
          endDate: '2024-01-01',
        },
        'ws-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
