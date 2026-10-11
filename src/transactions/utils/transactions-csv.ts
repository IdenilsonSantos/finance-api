import { TransactionEntity } from '../../core/entities/transaction.entity';
import { categoryLabel } from '../../core/utils/categories';

/** Limite de linhas por exportação (proteção contra respostas gigantes). */
export const EXPORT_MAX_ROWS = 20000;

const PAYMENT_METHODS: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  cash: 'Dinheiro',
  transfer: 'Transferência',
  boleto: 'Boleto',
};

const HEADER = [
  'Data',
  'Descrição',
  'Beneficiário',
  'Categoria',
  'Tipo',
  'Valor',
  'Situação',
  'Conta',
  'Forma de pagamento',
  'Parcela',
];

/**
 * Campo CSV seguro: aspas quando necessário e neutralização de fórmulas
 * (texto começando com = + - @ é executado como fórmula pelo Excel/Sheets).
 */
export function csvField(value: string | null | undefined): string {
  let text = value ?? '';
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Valor com vírgula decimal e sinal (despesa negativa), como o Excel em pt-BR espera. */
function formatAmount(cents: number, type: 'income' | 'expense'): string {
  const signed = type === 'expense' ? -cents : cents;
  const abs = Math.abs(signed);
  const value = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return signed < 0 ? `-${value}` : value;
}

/**
 * CSV de transações para planilhas em português: separador ";", vírgula
 * decimal, datas dd/mm/aaaa e BOM para o Excel reconhecer o UTF-8.
 */
export function buildTransactionsCsv(
  transactions: TransactionEntity[],
  accountNames: Map<string, string>,
  labelOf: (category: string) => string = categoryLabel,
): string {
  const lines = transactions.map((t) =>
    [
      formatDate(t.date),
      csvField(t.description),
      csvField(t.beneficiary),
      csvField(labelOf(t.category)),
      t.type === 'income' ? 'Receita' : 'Despesa',
      // Número gerado aqui: fica sem a proteção de fórmula para continuar numérico.
      formatAmount(t.amount, t.type),
      t.status === 'pending' ? 'Pendente' : 'Efetivada',
      csvField(accountNames.get(t.bankAccountId) ?? ''),
      csvField(t.paymentMethod ? (PAYMENT_METHODS[t.paymentMethod] ?? t.paymentMethod) : ''),
      t.installmentTotal && t.installmentTotal > 1 ? `${t.installmentNumber}/${t.installmentTotal}` : '',
    ].join(';'),
  );
  return '\uFEFF' + [HEADER.join(';'), ...lines].join('\r\n') + '\r\n';
}
