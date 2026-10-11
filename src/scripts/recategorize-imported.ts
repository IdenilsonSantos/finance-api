import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { and, eq, isNotNull, ne } from 'drizzle-orm';
import * as schema from '../db/schema';
import { ADJUSTMENT_CATEGORY, OWN_TRANSFER_CATEGORY } from '../core/entities/transaction.entity';
import { CategoryInferenceService } from '../bank-accounts/services/category-inference.service';
import { isOwnTransfer } from '../core/utils/own-transfers';

/**
 * Corrige a categoria de transações importadas antes de duas correções:
 * - palavras-chave casavam dentro de outras palavras ("game" em "pagamento"
 *   virava Entretenimento);
 * - Pix/TED entre contas do próprio usuário viravam receita/despesa.
 *
 * Só altera transações vindas de extrato cuja categoria atual é exatamente a
 * que o algoritmo antigo teria dado — categorias trocadas à mão ficam como estão.
 *
 * Uso: npm run recategorize:imported            (simulação)
 *      npm run recategorize:imported -- --apply (grava)
 */

const apply = process.argv.includes('--apply');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const INCOME_ONLY = new Set(['salary', 'investment', 'freelance']);

/** Algoritmo antigo: substring, palavra-chave sem normalizar, ordem do banco. */
function oldInfer(rules: { category: string; keyword: string }[], description: string, type: string): string {
  if (!description || rules.length === 0) return 'others';
  const normalized = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const candidates = type === 'income' ? rules.filter((r) => INCOME_ONLY.has(r.category)) : rules;
  for (const rule of candidates) if (normalized.includes(rule.keyword)) return rule.category;
  return 'others';
}

async function main() {
  const rules = await db
    .select({ category: schema.categoryRule.category, keyword: schema.categoryRule.keyword })
    .from(schema.categoryRule);
  const inference = new CategoryInferenceService(db as any);
  await inference.loadRules();

  const members = await db
    .select({ workspaceId: schema.workspaceMember.workspaceId, name: schema.user.name })
    .from(schema.workspaceMember)
    .innerJoin(schema.user, eq(schema.workspaceMember.userId, schema.user.id));
  const namesByWorkspace = new Map<string, (string | null)[]>();
  for (const m of members) namesByWorkspace.set(m.workspaceId, [...(namesByWorkspace.get(m.workspaceId) ?? []), m.name]);

  const rows = await db
    .select()
    .from(schema.transaction)
    .where(and(isNotNull(schema.transaction.externalId), ne(schema.transaction.category, ADJUSTMENT_CATEGORY)))
    .orderBy(schema.transaction.date);

  let changed = 0;
  for (const tx of rows) {
    const description = tx.description ?? '';
    const old = oldInfer(rules, description, tx.type);
    let next: string | null = null;
    if (isOwnTransfer(description, namesByWorkspace.get(tx.workspaceId) ?? [])) {
      // "Outros" é o padrão quando nada casava: também não foi escolha manual.
      if (tx.category !== OWN_TRANSFER_CATEGORY && (tx.category === old || tx.category === 'others')) {
        next = OWN_TRANSFER_CATEGORY;
      }
    } else if (tx.category === old) {
      const fixed = inference.infer(description, tx.type);
      if (fixed !== tx.category) next = fixed;
    }
    if (!next) continue;

    changed++;
    console.log(`${apply ? 'Corrigindo' : '[simulação]'} ${tx.date} "${description.slice(0, 70)}": ${tx.category} -> ${next}`);
    if (apply) {
      await db
        .update(schema.transaction)
        .set({ category: next, updatedAt: new Date() })
        .where(eq(schema.transaction.id, tx.id));
    }
  }

  console.log(`${changed} transação(ões) ${apply ? 'corrigida(s)' : 'a corrigir (rode com --apply para gravar)'}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
