import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IScheduledTransactionRepository } from '../../core/repositories/scheduled-transaction.repository.interface';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import { ITransactionRepository } from '../../core/repositories/transaction.repository.interface';
import { ScheduledTransactionEntity } from '../../core/entities/scheduled-transaction.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
  CreateScheduledTransactionDto,
  UpdateScheduledTransactionDto,
  ListScheduledTransactionsDto,
} from '../dto/scheduled-transaction.dto';
import { APP_TIMEZONE, nextOccurrence, todayISO } from '../../core/utils/date';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

// Limite de ocorrências atrasadas executadas de uma vez por agendamento
// (ex.: recorrência diária com o servidor parado por muito tempo).
const MAX_CATCH_UP_OCCURRENCES = 400;

@Injectable()
export class ScheduledTransactionsService {
  private readonly logger = new Logger(ScheduledTransactionsService.name);

  constructor(
    @Inject(IScheduledTransactionRepository)
    private readonly scheduledTransactionRepository: IScheduledTransactionRepository,
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
    @Inject(ITransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateScheduledTransactionDto, workspaceId: string) {
    const account = await this.bankAccountRepository.findById(
      dto.bankAccountId,
      workspaceId,
    );
    if (!account) throw new NotFoundException('Conta bancária não encontrada');
    this.assertEndDate(dto.nextDate, dto.endDate);

    const amountInCents = Math.round(dto.amount * 100);

    return this.scheduledTransactionRepository.create({
      ...dto,
      amount: amountInCents,
      workspaceId,
    });
  }

  async findAll(workspaceId: string, filters: ListScheduledTransactionsDto) {
    return this.scheduledTransactionRepository.findAllByWorkspace(workspaceId, {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      frequency: filters.frequency,
      accountId: filters.accountId,
    });
  }

  async findOne(id: string, workspaceId: string) {
    const scheduled = await this.scheduledTransactionRepository.findById(
      id,
      workspaceId,
    );
    if (!scheduled) throw new NotFoundException('Transação agendada não encontrada');
    return scheduled;
  }

  async update(id: string, workspaceId: string, dto: UpdateScheduledTransactionDto) {
    const current = await this.findOne(id, workspaceId);

    if (dto.bankAccountId && dto.bankAccountId !== current.bankAccountId) {
      const account = await this.bankAccountRepository.findById(dto.bankAccountId, workspaceId);
      if (!account) throw new NotFoundException('Conta bancária não encontrada');
    }

    this.assertEndDate(
      dto.nextDate ?? current.nextDate,
      dto.endDate === undefined ? current.endDate : dto.endDate,
    );

    const data: Record<string, any> = { ...dto };
    if (dto.amount !== undefined) {
      data.amount = Math.round(dto.amount * 100);
    }

    return this.scheduledTransactionRepository.update(id, workspaceId, data);
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    await this.scheduledTransactionRepository.delete(id, workspaceId);
  }

  /** Executa ("paga") agora a próxima ocorrência do agendamento. */
  async execute(id: string, workspaceId: string) {
    const scheduled = await this.findOne(id, workspaceId);

    if (scheduled.endDate && scheduled.nextDate > scheduled.endDate) {
      throw new BadRequestException(
        'Esta transação agendada já passou da data de término',
      );
    }

    const account = await this.bankAccountRepository.findById(
      scheduled.bankAccountId,
      workspaceId,
    );
    if (!account) throw new NotFoundException('Conta bancária não encontrada');

    const result = await this.runOccurrence(scheduled);
    if (!result.executed) {
      throw new ConflictException('Esta ocorrência já foi executada');
    }

    await this.notifyExecuted(scheduled, 1);

    return result.next;
  }

  /**
   * Lança a ocorrência `scheduled.nextDate` e avança o agendamento (ou o
   * encerra), tudo numa única transação de banco. A reivindicação condicional
   * da ocorrência garante que cron e execução manual simultâneos não gerem
   * lançamento em dobro.
   */
  private async runOccurrence(
    scheduled: ScheduledTransactionEntity,
  ): Promise<{ executed: boolean; next: ScheduledTransactionEntity | null }> {
    const candidate = nextOccurrence(scheduled.frequency, scheduled.nextDate);
    const finished =
      !candidate || (!!scheduled.endDate && candidate > scheduled.endDate);
    const newNextDate = finished ? null : candidate;

    const executed = await this.db.transaction(async (trx) => {
      const claimed = await this.scheduledTransactionRepository.claimOccurrence(
        scheduled.id,
        scheduled.nextDate,
        newNextDate,
        trx,
      );
      if (!claimed) return false;

      await this.transactionRepository.create(
        {
          workspaceId: scheduled.workspaceId,
          bankAccountId: scheduled.bankAccountId,
          amount: scheduled.amount,
          type: scheduled.type,
          description: scheduled.description,
          category: scheduled.category,
          date: scheduled.nextDate,
        },
        trx,
      );

      const delta = scheduled.type === 'income' ? scheduled.amount : -scheduled.amount;
      await this.bankAccountRepository.updateBalance(scheduled.bankAccountId, delta, trx);
      return true;
    });

    return {
      executed,
      next: executed && newNextDate ? { ...scheduled, nextDate: newNextDate } : null,
    };
  }

  private assertEndDate(nextDate: string, endDate?: string | null) {
    if (endDate && endDate < nextDate) {
      throw new BadRequestException(
        'A data de término deve ser igual ou posterior à próxima data',
      );
    }
  }

  private async notifyExecuted(scheduled: ScheduledTransactionEntity, occurrences: number) {
    const desc = scheduled.description ?? scheduled.category;
    const signal = scheduled.type === 'income' ? '+' : '-';
    const amountFmt = (scheduled.amount / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const suffix = occurrences > 1 ? ` (${occurrences} ocorrências)` : '';

    await this.notificationsService.notifyWorkspace(
      scheduled.workspaceId,
      'scheduledReminder',
      {
        title: `Transação agendada executada`,
        body: `${desc}: ${signal}${amountFmt}${suffix}`,
      },
      (email) =>
        this.notificationsService.sendScheduledTransactionExecuted({
          to: email,
          description: desc,
          amount: scheduled.amount,
          type: scheduled.type,
          date: scheduled.nextDate,
        }),
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: APP_TIMEZONE })
  async handleDueTransactions(): Promise<void> {
    const today = todayISO();
    const due = await this.scheduledTransactionRepository.findDue(today);

    this.logger.log(`Cron: ${due.length} transação(ões) agendada(s) a executar para ${today}`);

    for (const initial of due) {
      try {
        const account = await this.bankAccountRepository.findById(
          initial.bankAccountId,
          initial.workspaceId,
        );
        if (!account) {
          this.logger.warn(`Conta ${initial.bankAccountId} não encontrada para scheduled ${initial.id} — pulando`);
          continue;
        }

        // Catch-up: executa todas as ocorrências vencidas até hoje (ex.: o
        // servidor ficou fora do ar ou o agendamento foi criado no passado).
        let current: ScheduledTransactionEntity | null = initial;
        let executedCount = 0;
        while (
          current &&
          current.nextDate <= today &&
          (!current.endDate || current.nextDate <= current.endDate) &&
          executedCount < MAX_CATCH_UP_OCCURRENCES
        ) {
          const result = await this.runOccurrence(current);
          if (!result.executed) break;
          executedCount++;
          current = result.next;
        }

        if (executedCount === 0) continue;

        this.logger.log(
          `Executada: scheduled=${initial.id} workspace=${initial.workspaceId} ocorrências=${executedCount}`,
        );
        await this.notifyExecuted(initial, executedCount);
      } catch (error) {
        this.logger.error(
          `Falha ao executar scheduled=${initial.id} workspace=${initial.workspaceId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(`Cron: concluído para ${today}`);
  }
}
