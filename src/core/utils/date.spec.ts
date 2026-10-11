import { monthEndISO, nextOccurrence, parseISODate } from './date';

describe('date utils', () => {
  describe('nextOccurrence', () => {
    it('avança dias, semanas e anos', () => {
      expect(nextOccurrence('daily', '2024-12-31')).toBe('2025-01-01');
      expect(nextOccurrence('weekly', '2024-02-26')).toBe('2024-03-04');
      expect(nextOccurrence('yearly', '2024-05-10')).toBe('2025-05-10');
    });

    it('mensal mantém o mesmo dia', () => {
      expect(nextOccurrence('monthly', '2024-01-15')).toBe('2024-02-15');
      expect(nextOccurrence('monthly', '2024-12-05')).toBe('2025-01-05');
    });

    it('mensal limita ao último dia do mês em vez de transbordar', () => {
      expect(nextOccurrence('monthly', '2024-01-31')).toBe('2024-02-29');
      expect(nextOccurrence('monthly', '2023-01-31')).toBe('2023-02-28');
      expect(nextOccurrence('monthly', '2024-03-31')).toBe('2024-04-30');
    });

    it('anual em 29/02 cai em 28/02', () => {
      expect(nextOccurrence('yearly', '2024-02-29')).toBe('2025-02-28');
    });

    it('única não tem próxima ocorrência', () => {
      expect(nextOccurrence('once', '2024-01-01')).toBeNull();
    });
  });

  it('parseISODate não volta um dia em fusos negativos', () => {
    expect(parseISODate('2024-01-31').getDate()).toBe(31);
  });

  it('monthEndISO', () => {
    expect(monthEndISO('2024-02')).toBe('2024-02-29');
    expect(monthEndISO('2023-02')).toBe('2023-02-28');
    expect(monthEndISO('2024-12')).toBe('2024-12-31');
  });
});
