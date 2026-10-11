import { invoiceMonthForDate, invoicePeriod, invoiceRemaining } from './credit-card';

describe('credit card invoices', () => {
  describe('fecha dia 25, vence dia 5 (fechamento no mês anterior)', () => {
    const cycle = { closingDay: 25, dueDay: 5 };

    it('compra antes do fechamento entra na fatura do mês seguinte', () => {
      expect(invoiceMonthForDate('2024-01-20', cycle)).toBe('2024-02');
    });

    it('compra no dia do fechamento já vai para a próxima fatura', () => {
      expect(invoiceMonthForDate('2024-01-25', cycle)).toBe('2024-03');
      expect(invoiceMonthForDate('2024-01-26', cycle)).toBe('2024-03');
    });

    it('período e datas da fatura', () => {
      expect(invoicePeriod('2024-02', cycle)).toEqual({
        month: '2024-02',
        start: '2023-12-25',
        end: '2024-01-24',
        closingDate: '2024-01-25',
        dueDate: '2024-02-05',
      });
    });
  });

  describe('fecha dia 3, vence dia 10 (mesmo mês)', () => {
    const cycle = { closingDay: 3, dueDay: 10 };

    it('compra antes do fechamento entra na fatura do mês', () => {
      expect(invoiceMonthForDate('2024-01-02', cycle)).toBe('2024-01');
      expect(invoiceMonthForDate('2024-01-03', cycle)).toBe('2024-02');
    });

    it('período e datas da fatura', () => {
      expect(invoicePeriod('2024-01', cycle)).toEqual({
        month: '2024-01',
        start: '2023-12-03',
        end: '2024-01-02',
        closingDate: '2024-01-03',
        dueDate: '2024-01-10',
      });
    });
  });

  it('fechamento no dia 31 respeita meses curtos', () => {
    const cycle = { closingDay: 31, dueDay: 8 };
    const march = invoicePeriod('2024-03', cycle);
    expect(march.closingDate).toBe('2024-02-29');
    expect(march.start).toBe('2024-01-31');
    expect(invoiceMonthForDate('2024-02-29', cycle)).toBe('2024-04');
  });

  describe('invoiceRemaining (pagamentos abatem as faturas mais antigas)', () => {
    it('fatura sem pagamento: falta o total', () => {
      // deve 1000 desta fatura + 300 de compras posteriores
      expect(invoiceRemaining(1000, 1300, 300)).toBe(1000);
    });

    it('pagamento antecipado, feito antes do fechamento, quita a fatura', () => {
      // pagou os 1000 antes de fechar; só restam as compras posteriores
      expect(invoiceRemaining(1000, 300, 300)).toBe(0);
    });

    it('pagamento parcial', () => {
      expect(invoiceRemaining(1000, 700, 300)).toBe(400);
    });

    it('fatura antiga em atraso continua devendo mesmo com compras novas', () => {
      // fatura de 1000 não paga + fatura seguinte de 500 + 200 em aberto
      expect(invoiceRemaining(1000, 1700, 700)).toBe(1000);
      // a fatura seguinte também não foi paga
      expect(invoiceRemaining(500, 1700, 200)).toBe(500);
    });

    it('pagou a mais: nada a pagar', () => {
      expect(invoiceRemaining(1000, 0, 300)).toBe(0);
    });

    it('fatura só com estornos não tem o que pagar', () => {
      expect(invoiceRemaining(-50, 400, 0)).toBe(0);
    });
  });

  it('períodos consecutivos não se sobrepõem nem deixam buracos', () => {
    const cycle = { closingDay: 10, dueDay: 17 };
    const a = invoicePeriod('2024-05', cycle);
    const b = invoicePeriod('2024-06', cycle);
    expect(b.start).toBe(a.closingDate);
  });
});
