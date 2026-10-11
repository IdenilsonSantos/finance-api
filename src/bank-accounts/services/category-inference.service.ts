import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

type TransactionType = 'income' | 'expense';

const INCOME_ONLY = new Set(['salary', 'investment', 'freelance']);

interface CompiledRule {
  category: string;
  keyword: string;
  pattern: RegExp;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A palavra-chave precisa aparecer como palavra inteira: "game" não pode
 * casar com "pagamento", nem "tim" com "estimativa".
 */
function compile(keyword: string): RegExp {
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(keyword)}(?:[^a-z0-9]|$)`);
}

@Injectable()
export class CategoryInferenceService implements OnModuleInit {
  private rules: { category: string; keyword: string }[] = [];
  private compiled: CompiledRule[] | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async onModuleInit() {
    await this.loadRules();
  }

  async loadRules() {
    this.rules = await this.db
      .select({ category: schema.categoryRule.category, keyword: schema.categoryRule.keyword })
      .from(schema.categoryRule);
    this.compiled = null;
  }

  /**
   * Regras com palavra-chave normalizada (sem acento) e compilada. As mais
   * longas vêm primeiro, para a mais específica vencer ("aluguel de carro"
   * antes de "aluguel").
   */
  private compiledRules(): CompiledRule[] {
    if (!this.compiled) {
      this.compiled = this.rules
        .map((r) => ({ category: r.category, keyword: normalize(r.keyword).trim() }))
        .filter((r) => r.keyword.length > 0)
        .sort((a, b) => b.keyword.length - a.keyword.length)
        .map((r) => ({ ...r, pattern: compile(r.keyword) }));
    }
    return this.compiled;
  }

  infer(description: string, type: TransactionType): string {
    if (!description || this.rules.length === 0) return 'others';

    const normalized = normalize(description);
    const candidates = this.compiledRules().filter(
      (r) => type !== 'income' || INCOME_ONLY.has(r.category),
    );

    for (const rule of candidates) {
      if (rule.pattern.test(normalized)) {
        return rule.category;
      }
    }

    return 'others';
  }
}
