import { BadRequestException } from '@nestjs/common';
import { TransfersService } from './transfers.service';

describe('TransfersService.update', () => {
  const accounts: Record<string, any> = {
    a: { id: 'a', name: 'Conta A', archivedAt: null },
    b: { id: 'b', name: 'Conta B', archivedAt: null },
    c: { id: 'c', name: 'Conta C', archivedAt: null },
  };
  let transferRepo: any;
  let bankAccountRepo: any;
  let db: any;
  let service: TransfersService;

  beforeEach(() => {
    transferRepo = {
      findById: jest.fn().mockResolvedValue({ id: 't1', fromAccountId: 'a', toAccountId: 'b', amount: 10000 }),
      update: jest.fn(async (_id: string, _ws: string, data: any) => ({ id: 't1', ...data })),
    };
    bankAccountRepo = {
      findById: jest.fn(async (id: string) => accounts[id] ?? null),
      updateBalance: jest.fn(),
    };
    db = { transaction: jest.fn(async (cb: (trx: any) => Promise<unknown>) => cb(db)) };
    service = new TransfersService(transferRepo, bankAccountRepo, db, {} as any, { log: jest.fn() } as any);
  });

  /** Variação líquida de saldo por conta. */
  function netByAccount() {
    const net: Record<string, number> = {};
    for (const [id, delta] of bankAccountRepo.updateBalance.mock.calls) net[id] = (net[id] ?? 0) + delta;
    return net;
  }

  it('alterar o valor ajusta só a diferença nas duas contas', async () => {
    await service.update('t1', 'ws', { amount: 150 }, 'u');
    expect(netByAccount()).toEqual({ a: -5000, b: 5000 });
  });

  it('trocar a conta de destino devolve o valor à antiga e envia à nova', async () => {
    await service.update('t1', 'ws', { toAccountId: 'c' }, 'u');
    expect(netByAccount()).toEqual({ a: 0, b: -10000, c: 10000 });
    expect(transferRepo.update).toHaveBeenCalledWith(
      't1',
      'ws',
      expect.objectContaining({ fromAccountId: 'a', toAccountId: 'c', amount: 10000 }),
      db,
    );
  });

  it('recusa origem igual ao destino', async () => {
    await expect(service.update('t1', 'ws', { toAccountId: 'a' }, 'u')).rejects.toBeInstanceOf(BadRequestException);
    expect(bankAccountRepo.updateBalance).not.toHaveBeenCalled();
  });

  it('recusa conta arquivada', async () => {
    accounts.c.archivedAt = new Date();
    await expect(service.update('t1', 'ws', { toAccountId: 'c' }, 'u')).rejects.toBeInstanceOf(BadRequestException);
    accounts.c.archivedAt = null;
  });
});
