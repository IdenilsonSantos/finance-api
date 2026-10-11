import { isCardBillPayment, pickCardForPayment } from './card-payments';

describe('isCardBillPayment', () => {
  it.each([
    'Pagamento de fatura',
    'PAGTO FATURA CARTAO',
    'PAG FATURA ITAUCARD',
    'Pagamento fatura cartão de crédito',
    'Pgto cartão Itaucard',
    'FATURA NUBANK',
  ])('%s', (d) => expect(isCardBillPayment(d, 'expense')).toBe(true));

  it.each([
    ['Pagamento de boleto efetuado - LUIZA CRED', 'expense'],
    ['Compra no cartão de débito', 'expense'],
    ['Pagamento de fatura', 'income'],
    ['Faturamento serviço', 'expense'],
    ['Pagamento conta de luz', 'expense'],
  ] as const)('não: %s (%s)', (d, type) => expect(isCardBillPayment(d, type)).toBe(false));
});

describe('pickCardForPayment', () => {
  const card = (id: string, name: string, archivedAt: Date | null = null) =>
    ({ id, name, type: 'credit_card', archivedAt }) as any;

  it('único cartão ativo', () => {
    expect(pickCardForPayment([card('c1', 'Cartão Nubank')], 'Conta Itaú', 'Pagamento de fatura')?.id).toBe('c1');
  });

  it('vários cartões: usa o banco em comum com a conta de origem', () => {
    const cards = [card('c1', 'Nubank Roxinho'), card('c2', 'Itaucard Visa')];
    expect(pickCardForPayment(cards, 'Nubank', 'Pagamento de fatura')?.id).toBe('c1');
  });

  it('vários cartões: usa o banco citado na descrição', () => {
    const cards = [card('c1', 'Nubank'), card('c2', 'Itaucard')];
    expect(pickCardForPayment(cards, 'Conta corrente', 'PAG FATURA ITAUCARD')?.id).toBe('c2');
  });

  it('sem como decidir, não escolhe', () => {
    const cards = [card('c1', 'Visa'), card('c2', 'Master')];
    expect(pickCardForPayment(cards, 'Conta corrente', 'Pagamento de fatura')).toBeNull();
    expect(pickCardForPayment([], 'Nubank', 'Pagamento de fatura')).toBeNull();
    expect(pickCardForPayment([card('c1', 'Nubank', new Date())], 'Nubank', 'Pagamento de fatura')).toBeNull();
  });
});
