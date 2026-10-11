/**
 * Reconhece, pela descrição do extrato, aplicações e resgates de
 * investimentos (CDB, RDB, caixinhas, poupança, Tesouro...). Esses movimentos
 * não são despesa nem receita: o dinheiro só muda de lugar. Rendimentos,
 * juros e dividendos NÃO entram aqui — eles são receita de verdade.
 */
export type InvestmentMovement = 'deposit' | 'withdrawal';

const YIELD = /\b(rendimentos?|rend\.?|juros|dividendos?|jcp|proventos?|remuneracao)\b/;
const DEPOSIT = /\b(aplicacao|aplic|aplicado|aporte|investimento|guardado|guardar)\b/;
const WITHDRAWAL = /\b(resgate|resgatado|resg|retirada|resgatar)\b/;
const PRODUCT = /\b(cdb|rdb|lci|lca|cri|cra|tesouro|caixinha|cofrinho|porquinho|renda fixa|poupanca|debentures?)\b/;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function classifyInvestmentMovement(
  description: string | null | undefined,
  type: 'income' | 'expense',
): InvestmentMovement | null {
  if (!description) return null;
  const d = normalize(description);
  if (YIELD.test(d)) return null;

  if (type === 'expense') {
    if (WITHDRAWAL.test(d)) return null;
    return DEPOSIT.test(d) || PRODUCT.test(d) ? 'deposit' : null;
  }

  // Entrada: resgate explícito, produto de investimento, ou estorno de
  // aplicação automática (ex.: Itaú "RES APLIC AUT MAIS").
  return WITHDRAWAL.test(d) || PRODUCT.test(d) || DEPOSIT.test(d) ? 'withdrawal' : null;
}
