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
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
