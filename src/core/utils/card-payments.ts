import { BankAccountEntity } from '../entities/bank-account.entity';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Pagamento de fatura de cartão de crédito visto no extrato da conta
 * ("Pagamento de fatura", "PAGTO FATURA CARTAO", "Pgto cartão Itaucard").
 * Não é despesa: é dinheiro indo para o cartão, cujas compras já são as
 * despesas.
 */
export function isCardBillPayment(description: string | null | undefined, type: 'income' | 'expense'): boolean {
  if (!description || type !== 'expense') return false;
  const d = normalize(description);
  if (/\bfatura\b/.test(d)) return /\b(pagamento|pagto|pgto|pag|pagt)\b/.test(d) || /^fatura/.test(d);
  return /\b(pagamento|pagto|pgto|pag)\b/.test(d) && /\bcartao( de credito)?\b/.test(d);
}

const GENERIC_TOKENS = new Set([
  'conta', 'corrente', 'cartao', 'credito', 'de', 'do', 'da', 'banco', 'pagamentos', 'pagamento', 's', 'a', 'sa',
]);

function tokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !GENERIC_TOKENS.has(t)),
  );
}

/**
 * Qual cartão recebe o pagamento: o único cartão ativo, ou — havendo vários —
 * o que compartilha um nome (ex.: "nubank", "itau") com a conta de origem ou
 * com a descrição. Sem como decidir, retorna null e o lançamento segue como
 * despesa.
 */
export function pickCardForPayment(
  cards: Pick<BankAccountEntity, 'id' | 'name' | 'type' | 'archivedAt'>[],
  sourceAccountName: string,
  description: string,
) {
  const active = cards.filter((c) => c.type === 'credit_card' && !c.archivedAt);
  if (active.length === 1) return active[0];
  const hints = new Set([...tokens(sourceAccountName), ...tokens(description)]);
  const matches = active.filter((c) => [...tokens(c.name)].some((t) => hints.has(t)));
  return matches.length === 1 ? matches[0] : null;
}
