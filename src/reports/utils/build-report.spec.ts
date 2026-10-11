import { buildReport, monthsBetween, previousPeriod } from './build-report';

describe('previousPeriod', () => {
  it('mesma duração, terminando na véspera', () => {
    expect(previousPeriod('2024-03-01', '2024-03-31')).toEqual({ startDate: '2024-01-30', endDate: '2024-02-29' });
    // 01/01 a 30/06/2024 = 182 dias (ano bissexto)
    expect(previousPeriod('2024-01-01', '2024-06-30')).toEqual({ startDate: '2023-07-03', endDate: '2023-12-31' });
  });
});

describe('monthsBetween', () => {
  it('lista os meses do período, inclusive na virada do ano', () => {
    expect(monthsBetween('2023-11-15', '2024-02-10')).toEqual(['2023-11', '2023-12', '2024-01', '2024-02']);
  });
});

describe('buildReport', () => {
  const rows = [
    { month: '2024-01', category: 'salary', type: 'income' as const, total: 500000, count: 1 },
    { month: '2024-01', category: 'food', type: 'expense' as const, total: 100000, count: 10 },
    { month: '2024-02', category: 'salary', type: 'income' as const, total: 500000, count: 1 },
    { month: '2024-02', category: 'food', type: 'expense' as const, total: 150000, count: 12 },
    { month: '2024-02', category: 'housing', type: 'expense' as const, total: 250000, count: 1 },
  ];
  const previous = [
    { month: '2023-12', category: 'food', type: 'expense' as const, total: 200000, count: 15 },
    { month: '2023-12', category: 'health', type: 'expense' as const, total: 30000, count: 2 },
    { month: '2023-12', category: 'salary', type: 'income' as const, total: 900000, count: 2 },
  ];
  const report = buildReport('2024-01-01', '2024-02-29', rows, previous);

  it('totais e taxa de economia', () => {
    expect(report.totals).toEqual({
      income: 1000000,
      expense: 500000,
      balance: 500000,
      savingsRate: 0.5,
      incomeCount: 2,
      expenseCount: 23,
    });
    expect(report.previousTotals.expense).toBe(230000);
  });

  it('série mensal preenche todos os meses', () => {
    expect(report.months).toEqual([
      { month: '2024-01', income: 500000, expense: 100000, balance: 400000 },
      { month: '2024-02', income: 500000, expense: 400000, balance: 100000 },
    ]);
  });

  it('categorias com participação, variação e evolução', () => {
    const food = report.categories.find((c) => c.category === 'food')!;
    expect(food.total).toBe(250000);
    expect(food.share).toBe(0.5);
    expect(food.change).toBeCloseTo(0.25);
    expect(food.months).toEqual([
      { month: '2024-01', total: 100000 },
      { month: '2024-02', total: 150000 },
    ]);

    const housing = report.categories.find((c) => c.category === 'housing')!;
    expect(housing.change).toBeNull(); // não existia antes

    const health = report.categories.find((c) => c.category === 'health')!;
    expect(health.total).toBe(0); // só no período anterior
    expect(health.change).toBe(-1);
  });

  it('despesas primeiro, maiores no topo, empate pelo nome', () => {
    // food e housing empatam em 250000
    expect(report.categories.map((c) => `${c.type}:${c.category}`)).toEqual([
      'expense:food',
      'expense:housing',
      'expense:health',
      'income:salary',
    ]);
  });

  it('sem receitas, taxa de economia é null', () => {
    expect(buildReport('2024-01-01', '2024-01-31', [], []).totals.savingsRate).toBeNull();
  });
});
