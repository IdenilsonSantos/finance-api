/** Rótulos (pt-BR) das categorias padrão, para notificações e e-mails. */
const CATEGORY_LABELS: Record<string, string> = {
  all: 'Total do mês',
  food: 'Alimentação',
  transport: 'Transporte',
  health: 'Saúde',
  education: 'Educação',
  entertainment: 'Entretenimento',
  clothing: 'Vestuário',
  housing: 'Moradia',
  utilities: 'Serviços',
  salary: 'Salário',
  freelance: 'Freelance',
  investment: 'Investimentos',
  others: 'Outros',
  outros: 'Outros',
  adjustment: 'Ajuste',
  own_transfer: 'Transferência entre contas',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** Categorias padrão (chaves fixas), válidas em todo workspace. */
export const BUILTIN_CATEGORIES: { key: string; type: 'income' | 'expense' }[] = [
  ...['food', 'transport', 'health', 'education', 'entertainment', 'clothing', 'housing', 'utilities', 'own_transfer', 'others'].map(
    (key) => ({ key, type: 'expense' as const }),
  ),
  ...['salary', 'freelance', 'investment', 'own_transfer', 'others'].map((key) => ({ key, type: 'income' as const })),
];

export function isBuiltinCategory(key: string): boolean {
  return BUILTIN_CATEGORIES.some((c) => c.key === key);
}
