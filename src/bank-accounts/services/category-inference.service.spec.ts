import { CategoryInferenceService } from './category-inference.service';

/** Regras no formato da tabela categoryRule (amostra das reais, com acentos). */
const RULES = [
  { category: 'entertainment', keyword: 'game' },
  { category: 'entertainment', keyword: 'show' },
  { category: 'entertainment', keyword: 'netflix' },
  { category: 'utilities', keyword: 'tim' },
  { category: 'utilities', keyword: 'energia' },
  { category: 'salary', keyword: 'vale' },
  { category: 'salary', keyword: 'salário' },
  { category: 'clothing', keyword: 'tênis' },
  { category: 'food', keyword: 'açougue' },
  { category: 'food', keyword: 'ifood' },
  { category: 'transport', keyword: '99 pop' },
];

function service() {
  const s = new CategoryInferenceService({} as any);
  (s as any).rules = RULES;
  return s;
}

describe('CategoryInferenceService.infer', () => {
  it('casa palavras inteiras, não pedaços de palavra', () => {
    // "game" está dentro de "pagamento"; "tim" dentro de "estimativa".
    expect(service().infer('Pagamento de fatura', 'expense')).toBe('others');
    expect(service().infer('Pagamento de boleto efetuado - LUIZA CRED', 'expense')).toBe('others');
    expect(service().infer('Estimativa de imposto', 'expense')).toBe('others');
    expect(service().infer('Showroom de móveis', 'expense')).toBe('others');
  });

  it('continua reconhecendo as palavras-chave', () => {
    expect(service().infer('NETFLIX.COM', 'expense')).toBe('entertainment');
    expect(service().infer('Recarga TIM pré-pago', 'expense')).toBe('utilities');
    expect(service().infer('Conta de energia - COPEL', 'expense')).toBe('utilities');
    expect(service().infer('IFOOD *RESTAURANTE', 'expense')).toBe('food');
    expect(service().infer('Corrida 99 POP', 'expense')).toBe('transport');
  });

  it('palavras-chave com acento casam com a descrição sem acento e vice-versa', () => {
    expect(service().infer('Loja de TENIS esportivo', 'expense')).toBe('clothing');
    expect(service().infer('Acougue do Zé', 'expense')).toBe('food');
    expect(service().infer('Pagamento de salario', 'income')).toBe('salary');
  });

  it('receitas só usam categorias de receita', () => {
    expect(service().infer('Reembolso Netflix', 'income')).toBe('others');
  });
});
