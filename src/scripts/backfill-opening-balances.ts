import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { and, eq, or, sql } from 'drizzle-orm';
import { format } from 'date-fns';
import * as schema from '../db/schema';
import { ADJUSTMENT_CATEGORY } from '../core/entities/transaction.entity';

/**
 * Contas criadas antes do saldo inicial virar lançamento têm `balance`
 * maior/menor que o histórico (transações + transferências) — o que faz a
 * conciliação de extrato acusar divergência. Este script cria, para cada
 * conta com diferença, um lançamento de ajuste "Saldo inicial" datado no dia
 * do primeiro movimento da conta (ou da criação), sem alterar o saldo.
 *
 * Uso: npm run backfill:opening-balances            (simulação)
 *      npm run backfill:opening-balances -- --apply (grava)
 */

const apply = process.argv.includes('--apply');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  const accounts = await db.select().from(schema.bankAccount);
  let fixed = 0;

  for (const account of accounts) {
    const [tx] = await db
      .select({
        net: sql<string>`coalesce(sum(case when ${schema.transaction.type} = 'income' then ${schema.transaction.amount} else -${schema.transaction.amount} end), 0)`,
        firstDate: sql<string | null>`min(${schema.transaction.date})`,
      })
      .from(schema.transaction)
      // Pendentes (contas a pagar/receber) ainda não movimentaram o saldo.
      .where(and(eq(schema.transaction.bankAccountId, account.id), eq(schema.transaction.status, 'paid')));

    const [tr] = await db
      .select({
        net: sql<string>`coalesce(sum(case when ${schema.transfer.toAccountId} = ${account.id} then ${schema.transfer.amount} else -${schema.transfer.amount} end), 0)`,
        firstDate: sql<string | null>`min(${schema.transfer.date})`,
      })
      .from(schema.transfer)
      .where(
        or(
          eq(schema.transfer.fromAccountId, account.id),
          eq(schema.transfer.toAccountId, account.id),
        ),
      );

    const ledger = Number(tx?.net ?? 0) + Number(tr?.net ?? 0);
    const diff = account.balance - ledger;
    if (diff === 0) continue;

    const candidates = [tx?.firstDate, tr?.firstDate, format(account.createdAt, 'yyyy-MM-dd')]
      .filter((d): d is string => !!d)
      .sort();
    const date = candidates[0];

    console.log(
      `${apply ? 'Ajustando' : '[simulação]'} conta=${account.id} "${account.name}" ` +
        `saldo=${account.balance} histórico=${ledger} diferença=${diff} data=${date}`,
    );

    if (apply) {
      await db.insert(schema.transaction).values({
        workspaceId: account.workspaceId,
        bankAccountId: account.id,
        amount: Math.abs(diff),
        type: diff > 0 ? 'income' : 'expense',
        category: ADJUSTMENT_CATEGORY,
        description: 'Saldo inicial',
        date,
      });
    }
    fixed++;
  }

  console.log(
    `${fixed} conta(s) ${apply ? 'ajustada(s)' : 'precisam de ajuste (rode com --apply para gravar)'}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
