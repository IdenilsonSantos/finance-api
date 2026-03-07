import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { format, subMonths, addDays } from 'date-fns';
import * as schema from '../db/schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const d = (date: Date) => format(date, 'yyyy-MM-dd');
const now = new Date();
const month = (n: number) => subMonths(now, n);

async function main() {
  console.log('Iniciando seed...');

  // Usuário
  const [user] = await db
    .insert(schema.user)
    .values({
      name: 'João Silva',
      email: 'joao@exemplo.com',
      password: await bcrypt.hash('senha123', 10),
    })
    .onConflictDoUpdate({
      target: schema.user.email,
      set: { name: 'João Silva', updatedAt: now },
    })
    .returning();

  console.log(`Usuário: ${user.email}`);

  // Workspace
  const [ws] = await db
    .insert(schema.workspace)
    .values({
      name: 'Finanças Pessoais',
      slug: `financas-pessoais-${user.id.slice(0, 8)}`,
      ownerId: user.id,
    })
    .onConflictDoUpdate({
      target: schema.workspace.slug,
      set: { name: 'Finanças Pessoais', updatedAt: now },
    })
    .returning();

  await db
    .insert(schema.workspaceMember)
    .values({ workspaceId: ws.id, userId: user.id, role: 'owner' })
    .onConflictDoNothing();

  console.log(`Workspace: ${ws.name}`);

  // ── Contas bancárias ──────────────────────────────────────────────────────
  const [nubank, inter, poupanca, carteira] = await db
    .insert(schema.bankAccount)
    .values([
      { workspaceId: ws.id, name: 'Nubank', type: 'checking', color: '#820AD1', balance: 350000 },
      { workspaceId: ws.id, name: 'Banco Inter', type: 'checking', color: '#FF7A00', balance: 180000 },
      { workspaceId: ws.id, name: 'Poupança', type: 'savings', color: '#10b981', balance: 500000 },
      { workspaceId: ws.id, name: 'Carteira', type: 'cash', color: '#f59e0b', balance: 15000 },
    ])
    .returning();

  console.log('Contas bancárias criadas');

  // ── Transações (últimos 6 meses) ──────────────────────────────────────────
  type TxInsert = typeof schema.transaction.$inferInsert;

  const transactions: TxInsert[] = [];

  // Receitas mensais recorrentes
  for (let m = 5; m >= 0; m--) {
    const base = month(m);

    // Salário
    transactions.push({
      workspaceId: ws.id,
      bankAccountId: nubank.id,
      amount: 650000,
      type: 'income',
      category: 'salary',
      description: 'Salário',
      date: d(new Date(base.getFullYear(), base.getMonth(), 5)),
    });

    // Freelance (meses alternados)
    if (m % 2 === 0) {
      transactions.push({
        workspaceId: ws.id,
        bankAccountId: inter.id,
        amount: 150000,
        type: 'income',
        category: 'freelance',
        description: 'Projeto freelance',
        date: d(new Date(base.getFullYear(), base.getMonth(), 15)),
      });
    }

    // Rendimento poupança
    transactions.push({
      workspaceId: ws.id,
      bankAccountId: poupanca.id,
      amount: 3500,
      type: 'income',
      category: 'investment',
      description: 'Rendimento poupança',
      date: d(new Date(base.getFullYear(), base.getMonth(), 1)),
    });

    // Despesas mensais
    const expenses: TxInsert[] = [
      { workspaceId: ws.id, bankAccountId: nubank.id, amount: 150000, type: 'expense', category: 'housing', description: 'Aluguel', date: d(new Date(base.getFullYear(), base.getMonth(), 10)) },
      { workspaceId: ws.id, bankAccountId: nubank.id, amount: 18000, type: 'expense', category: 'utilities', description: 'Energia elétrica', date: d(new Date(base.getFullYear(), base.getMonth(), 8)) },
      { workspaceId: ws.id, bankAccountId: nubank.id, amount: 9000, type: 'expense', category: 'utilities', description: 'Internet', date: d(new Date(base.getFullYear(), base.getMonth(), 12)) },
      { workspaceId: ws.id, bankAccountId: nubank.id, amount: 4500, type: 'expense', category: 'utilities', description: 'Água', date: d(new Date(base.getFullYear(), base.getMonth(), 14)) },
      { workspaceId: ws.id, bankAccountId: inter.id, amount: 35000, type: 'expense', category: 'food', description: 'Supermercado', date: d(new Date(base.getFullYear(), base.getMonth(), 7)) },
      { workspaceId: ws.id, bankAccountId: inter.id, amount: 28000, type: 'expense', category: 'food', description: 'Supermercado', date: d(new Date(base.getFullYear(), base.getMonth(), 21)) },
      { workspaceId: ws.id, bankAccountId: carteira.id, amount: 8500, type: 'expense', category: 'food', description: 'Restaurante', date: d(new Date(base.getFullYear(), base.getMonth(), 13)) },
      { workspaceId: ws.id, bankAccountId: carteira.id, amount: 4200, type: 'expense', category: 'food', description: 'Lanche', date: d(new Date(base.getFullYear(), base.getMonth(), 18)) },
      { workspaceId: ws.id, bankAccountId: nubank.id, amount: 12000, type: 'expense', category: 'transport', description: 'Combustível', date: d(new Date(base.getFullYear(), base.getMonth(), 9)) },
      { workspaceId: ws.id, bankAccountId: nubank.id, amount: 3800, type: 'expense', category: 'transport', description: 'Uber', date: d(new Date(base.getFullYear(), base.getMonth(), 17)) },
      { workspaceId: ws.id, bankAccountId: nubank.id, amount: 9900, type: 'expense', category: 'health', description: 'Plano de saúde', date: d(new Date(base.getFullYear(), base.getMonth(), 6)) },
      { workspaceId: ws.id, bankAccountId: nubank.id, amount: 15000, type: 'expense', category: 'education', description: 'Curso online', date: d(new Date(base.getFullYear(), base.getMonth(), 3)) },
    ];

    // Entretenimento (variado)
    const entertainment = [12000, 8500, 15000, 6000, 18000, 9500][m];
    expenses.push({
      workspaceId: ws.id,
      bankAccountId: inter.id,
      amount: entertainment,
      type: 'expense',
      category: 'entertainment',
      description: 'Streaming / Lazer',
      date: d(new Date(base.getFullYear(), base.getMonth(), 20)),
    });

    // Roupas (meses alternados)
    if (m % 3 === 0) {
      expenses.push({
        workspaceId: ws.id,
        bankAccountId: inter.id,
        amount: 25000,
        type: 'expense',
        category: 'clothing',
        description: 'Roupas',
        date: d(new Date(base.getFullYear(), base.getMonth(), 25)),
      });
    }

    transactions.push(...expenses);
  }

  await db.insert(schema.transaction).values(transactions);
  console.log(`${transactions.length} transações criadas`);

  // Orçamentos (mês atual)
  const currentMonth = format(now, 'yyyy-MM');

  await db
    .insert(schema.budget)
    .values([
      { workspaceId: ws.id, category: 'all', amount: 400000, month: currentMonth },
      { workspaceId: ws.id, category: 'food', amount: 80000, month: currentMonth },
      { workspaceId: ws.id, category: 'transport', amount: 20000, month: currentMonth },
      { workspaceId: ws.id, category: 'housing', amount: 160000, month: currentMonth },
      { workspaceId: ws.id, category: 'entertainment', amount: 15000, month: currentMonth },
      { workspaceId: ws.id, category: 'health', amount: 15000, month: currentMonth },
      { workspaceId: ws.id, category: 'education', amount: 20000, month: currentMonth },
    ])
    .onConflictDoNothing();

  console.log('Orçamentos criados');

  // Metas
  await db.insert(schema.goal).values([
    {
      workspaceId: ws.id,
      name: 'Fundo de Emergência',
      targetAmount: 2000000,
      currentAmount: 500000,
      deadline: d(addDays(now, 365)),
      color: '#10b981',
    },
    {
      workspaceId: ws.id,
      name: 'Viagem para Europa',
      targetAmount: 1500000,
      currentAmount: 320000,
      deadline: d(addDays(now, 548)),
      color: '#6366f1',
    },
    {
      workspaceId: ws.id,
      name: 'Notebook Novo',
      targetAmount: 800000,
      currentAmount: 600000,
      deadline: d(addDays(now, 90)),
      color: '#f59e0b',
    },
    {
      workspaceId: ws.id,
      name: 'Carro',
      targetAmount: 8000000,
      currentAmount: 1200000,
      deadline: d(addDays(now, 1095)),
      color: '#ef4444',
    },
  ]);

  console.log('Metas criadas');

  // Transações agendadas
  await db.insert(schema.scheduledTransaction).values([
    {
      workspaceId: ws.id,
      bankAccountId: nubank.id,
      amount: 150000,
      type: 'expense',
      category: 'housing',
      description: 'Aluguel',
      frequency: 'monthly',
      nextDate: d(new Date(now.getFullYear(), now.getMonth(), 10)),
    },
    {
      workspaceId: ws.id,
      bankAccountId: nubank.id,
      amount: 9900,
      type: 'expense',
      category: 'health',
      description: 'Plano de saúde',
      frequency: 'monthly',
      nextDate: d(new Date(now.getFullYear(), now.getMonth(), 6)),
    },
    {
      workspaceId: ws.id,
      bankAccountId: nubank.id,
      amount: 9000,
      type: 'expense',
      category: 'utilities',
      description: 'Internet',
      frequency: 'monthly',
      nextDate: d(new Date(now.getFullYear(), now.getMonth(), 12)),
    },
    {
      workspaceId: ws.id,
      bankAccountId: nubank.id,
      amount: 650000,
      type: 'income',
      category: 'salary',
      description: 'Salário',
      frequency: 'monthly',
      nextDate: d(new Date(now.getFullYear(), now.getMonth(), 5)),
    },
    {
      workspaceId: ws.id,
      bankAccountId: poupanca.id,
      amount: 50000,
      type: 'expense',
      category: 'investment',
      description: 'Aporte mensal poupança',
      frequency: 'monthly',
      nextDate: d(new Date(now.getFullYear(), now.getMonth(), 1)),
    },
  ]);

  console.log('Transações agendadas criadas');

  // Resumo
  console.log('\nSeed concluído!');
  console.log('─────────────────────────────────');
  console.log(`   Email:  joao@exemplo.com`);
  console.log(`   Senha:  senha123`);
  console.log(`   WorkspaceId: ${ws.id}`);
  console.log('─────────────────────────────────');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => pool.end());
