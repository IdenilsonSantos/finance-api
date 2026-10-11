import { InvestmentAccountsService } from './investment-accounts.service';

describe('InvestmentAccountsService', () => {
  const source = { id: 'acc-1', workspaceId: 'ws-1', name: 'Nubank' } as any;

  it('reutiliza a conta de investimento já vinculada', async () => {
    const linked = { id: 'inv-1' };
    const repo = { findLinkedInvestmentAccount: jest.fn().mockResolvedValue(linked), create: jest.fn() };
    const service = new InvestmentAccountsService(repo as any);

    await expect(service.findOrCreate(source, 'trx')).resolves.toBe(linked);
    expect(repo.findLinkedInvestmentAccount).toHaveBeenCalledWith('acc-1', 'ws-1', 'trx');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('cria "Investimentos · <conta>" vinculada à conta de origem', async () => {
    const repo = {
      findLinkedInvestmentAccount: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'inv-new' }),
    };
    const service = new InvestmentAccountsService(repo as any);

    await service.findOrCreate(source, 'trx');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        name: 'Investimentos · Nubank',
        type: 'investment',
        balance: 0,
        linkedAccountId: 'acc-1',
      }),
      'trx',
    );
  });
});
