import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, lte, notInArray, sql, SQL } from 'drizzle-orm';
import { differenceInCalendarDays } from 'date-fns';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';
import { NON_FLOW_CATEGORIES } from '../../core/entities/transaction.entity';
import { parseISODate } from '../../core/utils/date';
import { ReportQueryDto } from '../dto/report.dto';
import { buildReport, previousPeriod, ReportRow } from '../utils/build-report';

/** Limite do período de um relatório (cerca de 2 anos). */
const MAX_DAYS = 731;

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Relatório do período: totais, mês a mês e por categoria, comparando com o
   * período anterior de mesma duração. Considera só o que foi efetivado e
   * deixa de fora ajustes e transferências entre contas próprias.
   */
  async getReport(workspaceId: string, query: ReportQueryDto) {
    const { startDate, endDate, accountId } = query;
    const days = differenceInCalendarDays(parseISODate(endDate), parseISODate(startDate)) + 1;
    if (days < 1) throw new BadRequestException('A data final deve ser igual ou posterior à inicial');
    if (days > MAX_DAYS) throw new BadRequestException('Escolha um período de até 2 anos');

    const previous = previousPeriod(startDate, endDate);
    const [rows, previousRows] = await Promise.all([
      this.aggregate(workspaceId, startDate, endDate, accountId),
      this.aggregate(workspaceId, previous.startDate, previous.endDate, accountId),
    ]);
    return buildReport(startDate, endDate, rows, previousRows);
  }

  private async aggregate(
    workspaceId: string,
    startDate: string,
    endDate: string,
    accountId?: string,
  ): Promise<ReportRow[]> {
    const t = schema.transaction;
    const conditions: SQL[] = [
      eq(t.workspaceId, workspaceId),
      eq(t.status, 'paid'),
      notInArray(t.category, NON_FLOW_CATEGORIES),
      gte(t.date, startDate),
      lte(t.date, endDate),
    ];
    if (accountId) conditions.push(eq(t.bankAccountId, accountId));

    const month = sql<string>`to_char(${t.date}, 'YYYY-MM')`;
    const rows = await this.db
      .select({
        month,
        category: t.category,
        type: t.type,
        total: sql<string>`sum(${t.amount})`,
        count: sql<string>`count(*)`,
      })
      .from(t)
      .where(and(...conditions))
      .groupBy(month, t.category, t.type);

    return rows.map((r) => ({
      month: r.month,
      category: r.category,
      type: r.type,
      total: Number(r.total),
      count: Number(r.count),
    }));
  }
}
