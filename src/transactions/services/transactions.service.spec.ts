import { BadRequestException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let transactionRepo: any;
  let bankAccountRepo: any;
  let db: any;
  let service: TransactionsService;

  const card = { id: 'card-1', name: 'Nubank', type: 'credit_card', archivedAt: null };
  const checking = { id: 'acc-1', name: 'Itaú', type: 'checking', archivedAt: null };

  beforeEach(() => {
    transactionRepo = {
      create: jest.fn(async (data: any) => ({ id: `tx-${data.installmentNumber ?? 1}`, ...data })),
      findById: jest.fn(),
      findByInstallmentGroup: jest.fn(),
      delete: jest.fn(),
    };
    bankAccountRepo = { findById: jest.fn(), updateBalance: jest.fn() };
    db = { transaction: jest.fn(async (cb: (trx: any) => Promise<unknown>) => cb(db)) };
    const activity = { log: jest.fn() };
    service = new TransactionsService(transactionRepo, bankAccountRepo, db, activity as any);
  });

  const purchase = {
    bankAccountId: 'card-1',
    amount: 100,
    type: 'expense' as const,
    category: 'clothing',
    date: '2024-01-31',
  };

  it('parcela no cartão: divide centavos, datas mensais e debita o total', async () => {
    bankAccountRepo.findById.mockResolvedValue(card);

    await service.create({ ...purchase, installments: 3 }, 'ws-1', 'user-1');

    const rows = transactionRepo.create.mock.calls.map((c: any[]) => c[0]);
    expect(rows.map((r: any) => r.amount)).toEqual([3334, 3333, 3333]);
    expect(rows.map((r: any) => r.date)).toEqual(['2024-01-31', '2024-02-29', '2024-03-31']);
    expect(rows.map((r: any) => `${r.installmentNumber}/${r.installmentTotal}`)).toEqual([
      '1/3',
      '2/3',
      '3/3',
    ]);
    expect(new Set(rows.map((r: any) => r.installmentGroupId)).size).toBe(1);
    expect(rows[0]).not.toHaveProperty('installments');
    expect(bankAccountRepo.updateBalance).toHaveBeenCalledTimes(1);
    expect(bankAccountRepo.updateBalance).toHaveBeenCalledWith('card-1', -10000, db);
  });

  it('recusa parcelamento fora do cartão de crédito', async () => {
    bankAccountRepo.findById.mockResolvedValue(checking);
    await expect(
      service.create({ ...purchase, bankAccountId: 'acc-1', installments: 3 }, 'ws-1', 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionRepo.create).not.toHaveBeenCalled();
  });

  it('recusa lançamento em conta arquivada', async () => {
    bankAccountRepo.findById.mockResolvedValue({ ...checking, archivedAt: new Date() });
    await expect(
      service.create({ ...purchase, bankAccountId: 'acc-1' }, 'ws-1', 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('status pago/pendente', () => {
    const bill = {
      bankAccountId: 'acc-1',
      amount: 250,
      type: 'expense' as const,
      category: 'housing',
      date: '2024-02-10',
    };

    it('conta pendente não altera o saldo', async () => {
      bankAccountRepo.findById.mockResolvedValue(checking);

      await service.create({ ...bill, status: 'pending' }, 'ws-1', 'user-1');

      expect(transactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', amount: 25000 }),
        db,
      );
      expect(bankAccountRepo.updateBalance).not.toHaveBeenCalled();
    });

    it('sem status, a transação é criada como paga e altera o saldo', async () => {
      bankAccountRepo.findById.mockResolvedValue(checking);

      await service.create(bill, 'ws-1', 'user-1');

      expect(transactionRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid' }), db);
      expect(bankAccountRepo.updateBalance).toHaveBeenCalledWith('acc-1', -25000, db);
    });

    it('efetivar uma conta pendente aplica o valor ao saldo uma única vez', async () => {
      bankAccountRepo.findById.mockResolvedValue(checking);
      transactionRepo.findById.mockResolvedValue({
        id: 'tx-1',
        bankAccountId: 'acc-1',
        type: 'expense',
        amount: 25000,
        status: 'pending',
      });
      transactionRepo.update = jest.fn(async (_id: string, _ws: string, data: any) => data);

      await service.update('tx-1', 'ws-1', { status: 'paid' }, 'user-1');

      expect(bankAccountRepo.updateBalance).toHaveBeenCalledTimes(1);
      expect(bankAccountRepo.updateBalance).toHaveBeenCalledWith('acc-1', -25000, db);
    });

    it('voltar uma transação paga para pendente devolve o valor ao saldo', async () => {
      bankAccountRepo.findById.mockResolvedValue(checking);
      transactionRepo.findById.mockResolvedValue({
        id: 'tx-1',
        bankAccountId: 'acc-1',
        type: 'income',
        amount: 500000,
        status: 'paid',
      });
      transactionRepo.update = jest.fn(async (_id: string, _ws: string, data: any) => data);

      await service.update('tx-1', 'ws-1', { status: 'pending' }, 'user-1');

      expect(bankAccountRepo.updateBalance).toHaveBeenCalledTimes(1);
      expect(bankAccountRepo.updateBalance).toHaveBeenCalledWith('acc-1', -500000, db);
    });

    it('excluir uma conta pendente não mexe no saldo', async () => {
      bankAccountRepo.findById.mockResolvedValue(checking);
      transactionRepo.findById.mockResolvedValue({
        id: 'tx-1',
        bankAccountId: 'acc-1',
        type: 'expense',
        amount: 25000,
        status: 'pending',
      });

      await service.remove('tx-1', 'ws-1', 'user-1');

      expect(transactionRepo.delete).toHaveBeenCalledTimes(1);
      expect(bankAccountRepo.updateBalance).not.toHaveBeenCalled();
    });

    it('recusa compra pendente no cartão de crédito', async () => {
      bankAccountRepo.findById.mockResolvedValue(card);
      await expect(
        service.create({ ...purchase, status: 'pending' }, 'ws-1', 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('exclui todas as parcelas e devolve o limite', async () => {
    bankAccountRepo.findById.mockResolvedValue(card);
    transactionRepo.findById.mockResolvedValue({
      id: 'tx-2',
      bankAccountId: 'card-1',
      type: 'expense',
      amount: 3333,
      installmentGroupId: 'g-1',
    });
    transactionRepo.findByInstallmentGroup.mockResolvedValue([
      { id: 'tx-1', bankAccountId: 'card-1', type: 'expense', amount: 3334 },
      { id: 'tx-2', bankAccountId: 'card-1', type: 'expense', amount: 3333 },
      { id: 'tx-3', bankAccountId: 'card-1', type: 'expense', amount: 3333 },
    ]);

    await service.remove('tx-2', 'ws-1', 'user-1', 'installments');

    expect(transactionRepo.delete).toHaveBeenCalledTimes(3);
    const restored = bankAccountRepo.updateBalance.mock.calls.reduce(
      (acc: number, c: any[]) => acc + c[1],
      0,
    );
    expect(restored).toBe(10000);
  });
});
