import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IScheduledTransactionRepository } from '../../core/repositories/scheduled-transaction.repository.interface';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import { ITransactionRepository } from '../../core/repositories/transaction.repository.interface';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
  CreateScheduledTransactionDto,
  UpdateScheduledTransactionDto,
  ListScheduledTransactionsDto,
} from '../dto/scheduled-transaction.dto';
import type { ScheduledTransactionFrequency } from '../../core/entities/scheduled-transaction.entity';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

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
    await this.findOne(id, workspaceId);

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

    const nextDate = scheduled.frequency !== 'once'
      ? this.calculateNextDate(scheduled.frequency, scheduled.nextDate)
      : null;

    const result = await this.db.transaction(async (trx) => {
      await this.transactionRepository.create(
        {
          workspaceId,
          bankAccountId: scheduled.bankAccountId,
          amount: scheduled.amount,
          type: scheduled.type,
          description: scheduled.description,
          category: scheduled.category,
          date: scheduled.nextDate,
        },
        trx,
      );

      const delta =
        scheduled.type === 'income' ? scheduled.amount : -scheduled.amount;
      await this.bankAccountRepository.updateBalance(
        scheduled.bankAccountId,
        delta,
        trx,
      );

      if (scheduled.frequency === 'once') {
        await this.scheduledTransactionRepository.delete(id, workspaceId, trx);
        return null;
      }

      return this.scheduledTransactionRepository.update(
        id,
        workspaceId,
        { nextDate: nextDate as string },
        trx,
      );
    });

    const desc = scheduled.description ?? scheduled.category;
    const signal = scheduled.type === 'income' ? '+' : '-';
    const amount = (scheduled.amount / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    await this.notificationsService.notifyWorkspace(
      workspaceId,
      'scheduledReminder',
      {
        title: `Transação agendada executada`,
        body: `${desc}: ${signal}${amount}`,
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

    return result;
  }

  private calculateNextDate(
    frequency: ScheduledTransactionFrequency,
    current: string,
  ): string {
    const date = new Date(current);
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date.toISOString().slice(0, 10);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDueTransactions(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const due = await this.scheduledTransactionRepository.findDue(today);

    this.logger.log(`Cron: ${due.length} transação(ões) agendada(s) a executar para ${today}`);

    for (const scheduled of due) {
      try {
        const account = await this.bankAccountRepository.findById(
          scheduled.bankAccountId,
          scheduled.workspaceId,
        );
        if (!account) {
          this.logger.warn(`Conta ${scheduled.bankAccountId} não encontrada para scheduled ${scheduled.id} — pulando`);
          continue;
        }

        const nextDate = scheduled.frequency !== 'once'
          ? this.calculateNextDate(scheduled.frequency, scheduled.nextDate)
          : null;

        await this.db.transaction(async (trx) => {
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

          if (scheduled.frequency === 'once') {
            await this.scheduledTransactionRepository.delete(
              scheduled.id,
              scheduled.workspaceId,
              trx,
            );
          } else {
            await this.scheduledTransactionRepository.update(
              scheduled.id,
              scheduled.workspaceId,
              { nextDate: nextDate as string },
              trx,
            );
          }
        });

        const desc = scheduled.description ?? scheduled.category;
        const signal = scheduled.type === 'income' ? '+' : '-';
        const amountFmt = (scheduled.amount / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        });

        this.logger.log(`Executada: scheduled=${scheduled.id} workspace=${scheduled.workspaceId} ${signal}${amountFmt}`);

        await this.notificationsService.notifyWorkspace(
          scheduled.workspaceId,
          'scheduledReminder',
          {
            title: `Transação agendada executada`,
            body: `${desc}: ${signal}${amountFmt}`,
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
      } catch (error) {
        this.logger.error(
          `Falha ao executar scheduled=${scheduled.id} workspace=${scheduled.workspaceId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(`Cron: concluído para ${today}`);
  }
}
