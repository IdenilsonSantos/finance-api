import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

type TransactionType = 'income' | 'expense';

const INCOME_ONLY = new Set(['salary', 'investment', 'freelance']);

@Injectable()
export class CategoryInferenceService implements OnModuleInit {
  private rules: { category: string; keyword: string }[] = [];

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
  }

  infer(description: string, type: TransactionType): string {
    if (!description || this.rules.length === 0) return 'others';

    const normalized = description
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const candidates = type === 'income'
      ? this.rules.filter((r) => INCOME_ONLY.has(r.category))
      : this.rules;

    for (const rule of candidates) {
      if (normalized.includes(rule.keyword)) {
        return rule.category;
      }
    }

    return 'others';
  }
}
