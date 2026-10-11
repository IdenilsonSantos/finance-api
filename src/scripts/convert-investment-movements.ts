import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { and, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { ADJUSTMENT_CATEGORY } from '../core/entities/transaction.entity';
import { classifyInvestmentMovement } from '../core/utils/investments';
import { InvestmentAccountsService } from '../bank-accounts/services/investment-accounts.service';

/**
 * Aplicações e resgates importados antes da importação reconhecê-los ficaram
 * como despesa/receita. Este script converte essas transações (somente as
 * vindas de extrato) em transferências para a conta de investimento
 * vinculada, como a importação faz hoje. Os saldos das contas de origem não
 * mudam; a conta de investimento recebe os valores.
 *
 * Uso: npm run convert:investment-movements            (simulação)
 *      npm run convert:investment-movements -- --apply (grava)
 */

const apply = process.argv.includes('--apply');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

type Db = typeof db;
type Trx = Parameters<Parameters<Db['transaction']>[0]>[0];

async function investmentAccountFor(trx: Trx, source: typeof schema.bankAccount.$inferSelect) {
  const [existing] = await trx
    .select()
    .from(schema.bankAccount)
    .where(
      and(
        eq(schema.bankAccount.workspaceId, source.workspaceId),
        eq(schema.bankAccount.linkedAccountId, source.id),
        eq(schema.bankAccount.type, 'investment'),
        isNull(schema.bankAccount.archivedAt),
      ),
    )
    .limit(1);
  if (existing) return existing;
  const [created] = await trx
    .insert(schema.bankAccount)
    .values({
      workspaceId: source.workspaceId,
      name: InvestmentAccountsService.nameFor(source),
      type: 'investment',
      color: '#a855f7',
      balance: 0,
      linkedAccountId: source.id,
    })
    .returning();
  return created;
}

async function main() {
  const rows = await db
    .select({ tx: schema.transaction, account: schema.bankAccount })
    .from(schema.transaction)
    .innerJoin(schema.bankAccount, eq(schema.transaction.bankAccountId, schema.bankAccount.id))
    .where(
      and(
        isNotNull(schema.transaction.externalId),
        eq(schema.transaction.status, 'paid'),
        ne(schema.transaction.category, ADJUSTMENT_CATEGORY),
        isNull(schema.transaction.installmentGroupId),
        ne(schema.bankAccount.type, 'credit_card'),
        isNull(schema.bankAccount.archivedAt),
      ),
    )
    .orderBy(schema.transaction.date);

  const candidates = rows
    .map((r) => ({ ...r, kind: classifyInvestmentMovement(r.tx.description, r.tx.type) }))
    .filter((r) => r.kind !== null);

  for (const { tx, account, kind } of candidates) {
    const brl = (tx.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    console.log(
      `${apply ? 'Convertendo' : '[simulação]'} ${tx.date} "${tx.description}" ${brl} ` +
        `(${kind === 'deposit' ? 'aplicação' : 'resgate'}) conta="${account.name}"`,
    );
    if (!apply) continue;

    await db.transaction(async (trx) => {
      const investment = await investmentAccountFor(trx, account);
      const isDeposit = kind === 'deposit';
      await trx.delete(schema.transaction).where(eq(schema.transaction.id, tx.id));
      await trx.insert(schema.transfer).values({
        workspaceId: tx.workspaceId,
        fromAccountId: isDeposit ? account.id : investment.id,
        toAccountId: isDeposit ? investment.id : account.id,
        amount: tx.amount,
        description: tx.description,
        date: tx.date,
        externalId: tx.externalId,
      });
      // A conta de origem já refletia o movimento; só a de investimento muda.
      await trx
        .update(schema.bankAccount)
        .set({
          balance: sql`${schema.bankAccount.balance} + ${isDeposit ? tx.amount : -tx.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.bankAccount.id, investment.id));
    });
  }

  console.log(
    `${candidates.length} movimentação(ões) ${apply ? 'convertida(s)' : 'a converter (rode com --apply para gravar)'}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
