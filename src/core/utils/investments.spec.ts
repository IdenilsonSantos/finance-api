import { classifyInvestmentMovement } from './investments';

describe('classifyInvestmentMovement', () => {
  it.each([
    ['Aplicação RDB', 'expense', 'deposit'],
    ['APLICACAO CDB', 'expense', 'deposit'],
    ['APL APLIC AUT MAIS', 'expense', 'deposit'],
    ['Dinheiro guardado na caixinha', 'expense', 'deposit'],
    ['Transferência para poupança', 'expense', 'deposit'],
    ['Compra Tesouro Selic 2029', 'expense', 'deposit'],
    ['Resgate RDB', 'income', 'withdrawal'],
    ['RESGATE CDB', 'income', 'withdrawal'],
    ['RES APLIC AUT MAIS', 'income', 'withdrawal'],
    ['Resgate da caixinha', 'income', 'withdrawal'],
  ] as const)('%s (%s) -> %s', (description, type, expected) => {
    expect(classifyInvestmentMovement(description, type)).toBe(expected);
  });

  it.each([
    ['Rendimento RDB', 'income'],
    ['Rendimentos poupança', 'income'],
    ['Juros sobre capital próprio', 'income'],
    ['Dividendos ITSA4', 'income'],
    ['Supermercado Extra', 'expense'],
    ['Pix recebido Maria', 'income'],
    ['Netflix', 'expense'],
    ['', 'expense'],
  ] as const)('não é movimentação de investimento: %s (%s)', (description, type) => {
    expect(classifyInvestmentMovement(description, type)).toBeNull();
  });
});
