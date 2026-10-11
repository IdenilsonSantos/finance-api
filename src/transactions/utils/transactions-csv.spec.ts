import { buildTransactionsCsv, csvField } from './transactions-csv';

const tx = (overrides: any = {}) => ({
  id: 't1',
  workspaceId: 'ws',
  bankAccountId: 'acc-1',
  amount: 123456,
  type: 'expense',
  description: 'Supermercado',
  beneficiary: null,
  category: 'food',
  paymentMethod: 'pix',
  date: '2024-03-05',
  status: 'paid',
  externalId: null,
  installmentGroupId: null,
  installmentNumber: null,
  installmentTotal: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('csvField', () => {
  it('protege contra fórmulas', () => {
    expect(csvField('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvField('+55 11')).toBe("'+55 11");
    expect(csvField('-10')).toBe("'-10");
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('usa aspas para ; " e quebras de linha', () => {
    expect(csvField('a;b')).toBe('"a;b"');
    expect(csvField('diz "oi"')).toBe('"diz ""oi""' + '"');
    expect(csvField('linha\nnova')).toBe('"linha\nnova"');
    expect(csvField(null)).toBe('');
  });
});

describe('buildTransactionsCsv', () => {
  it('usa o nome da categoria personalizada', () => {
    const csv = buildTransactionsCsv(
      [tx({ category: 'cat-uuid' })] as any,
      new Map([['acc-1', 'Nubank']]),
      (key) => (key === 'cat-uuid' ? 'Pets' : key),
    );
    expect(csv).toContain(';Pets;Despesa;');
  });

  it('formato pt-BR com BOM, cabeçalho e valores', () => {
    const csv = buildTransactionsCsv(
      [
        tx(),
        tx({ type: 'income', amount: 500000, description: 'Salário', category: 'salary', paymentMethod: null }),
        tx({ status: 'pending', amount: 5, installmentNumber: 2, installmentTotal: 10 }),
      ] as any,
      new Map([['acc-1', 'Nubank']]),
    );
    const [header, ...rows] = csv.replace('\uFEFF', '').trimEnd().split('\r\n');

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(header).toBe('Data;Descrição;Beneficiário;Categoria;Tipo;Valor;Situação;Conta;Forma de pagamento;Parcela');
    expect(rows[0]).toBe('05/03/2024;Supermercado;;Alimentação;Despesa;-1234,56;Efetivada;Nubank;Pix;');
    expect(rows[1]).toBe('05/03/2024;Salário;;Salário;Receita;5000,00;Efetivada;Nubank;;');
    expect(rows[2]).toBe('05/03/2024;Supermercado;;Alimentação;Despesa;-0,05;Pendente;Nubank;Pix;2/10');
  });
});
