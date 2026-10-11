import { BudgetAlertsService, crossedThreshold } from './budget-alerts.service';

describe('crossedThreshold', () => {
  it('dispara 80% e 100% só na passagem', () => {
    expect(crossedThreshold(7000, 8000, 10000)).toBe(80);
    expect(crossedThreshold(7900, 9500, 10000)).toBe(80);
    expect(crossedThreshold(8500, 9000, 10000)).toBeNull();
    expect(crossedThreshold(9000, 10000, 10000)).toBe(100);
    expect(crossedThreshold(10500, 12000, 10000)).toBeNull();
  });

  it('um gasto que pula de baixo direto para cima de 100% avisa o estouro', () => {
    expect(crossedThreshold(1000, 15000, 10000)).toBe(100);
  });
});

describe('BudgetAlertsService', () => {
  let notifications: any;
  let service: BudgetAlertsService;

  beforeEach(() => {
    notifications = {
      notifyWorkspace: jest.fn().mockResolvedValue(undefined),
      sendBudgetAlert: jest.fn(),
    };
    const categories = {
      labelResolver: jest.fn().mockResolvedValue((key: string) =>
        ({ food: 'Alimentação', all: 'Total do mês', 'cat-1': 'Pets' })[key] ?? key,
      ),
    };
    service = new BudgetAlertsService({} as any, notifications, categories as any);
  });

  function stub(budgets: any[], spending: Record<string, number>) {
    jest.spyOn(service as any, 'findBudgets').mockResolvedValue(budgets);
    jest.spyOn(service as any, 'monthSpending').mockResolvedValue(new Map(Object.entries(spending)));
  }

  it('avisa quando o gasto cruza 80% do orçamento da categoria', async () => {
    stub([{ id: 'b1', category: 'food', amount: 100000, month: '2024-03' }], { food: 85000 });

    await service.checkThresholds('ws-1', [{ month: '2024-03', category: 'food', delta: 10000 }]);

    expect(notifications.notifyWorkspace).toHaveBeenCalledWith(
      'ws-1',
      'budgetAlert',
      expect.objectContaining({ title: 'Orçamento de Alimentação em 85%' }),
      expect.any(Function),
    );
  });

  it('usa o nome da categoria personalizada', async () => {
    stub([{ id: 'b2', category: 'cat-1', amount: 10000, month: '2024-03' }], { 'cat-1': 12000 });

    await service.checkThresholds('ws-1', [{ month: '2024-03', category: 'cat-1', delta: 5000 }]);

    expect(notifications.notifyWorkspace).toHaveBeenCalledWith(
      'ws-1',
      'budgetAlert',
      expect.objectContaining({ title: 'Orçamento de Pets estourado' }),
      expect.any(Function),
    );
  });

  it('não avisa de novo quem já tinha passado da faixa', async () => {
    stub([{ id: 'b1', category: 'food', amount: 100000, month: '2024-03' }], { food: 90000 });

    await service.checkThresholds('ws-1', [{ month: '2024-03', category: 'food', delta: 5000 }]);

    expect(notifications.notifyWorkspace).not.toHaveBeenCalled();
  });

  it('o limite total do mês considera o gasto de todas as categorias', async () => {
    stub([{ id: 'g', category: 'all', amount: 200000, month: '2024-03' }], { food: 120000, housing: 85000 });

    await service.checkThresholds('ws-1', [{ month: '2024-03', category: 'housing', delta: 20000 }]);

    expect(notifications.notifyWorkspace).toHaveBeenCalledWith(
      'ws-1',
      'budgetAlert',
      expect.objectContaining({ title: 'Orçamento de Total do mês estourado' }),
      expect.any(Function),
    );
  });

  it('reduções de gasto não geram alerta nem consultas', async () => {
    const find = jest.spyOn(service as any, 'findBudgets');

    await service.checkThresholds('ws-1', [{ month: '2024-03', category: 'food', delta: -5000 }]);

    expect(find).not.toHaveBeenCalled();
    expect(notifications.notifyWorkspace).not.toHaveBeenCalled();
  });
});
