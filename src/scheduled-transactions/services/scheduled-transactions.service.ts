import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IScheduledTransactionRepository } from '../../core/repositories/scheduled-transaction.repository.interface';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import { ITransactionRepository } from '../../core/repositories/transaction.repository.interface';
import {
  CreateScheduledTransactionDto,
  UpdateScheduledTransactionDto,
} from '../dto/scheduled-transaction.dto';
import type { ScheduledTransactionFrequency } from '../../core/entities/scheduled-transaction.entity';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

@Injectable()
export class ScheduledTransactionsService {
  constructor(
    @Inject(IScheduledTransactionRepository)
    private readonly scheduledTransactionRepository: IScheduledTransactionRepository,
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
    @Inject(ITransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
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

  async findAll(workspaceId: string) {
    return this.scheduledTransactionRepository.findAllByWorkspace(workspaceId);
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

    const nextDate = this.calculateNextDate(scheduled.frequency, scheduled.nextDate);

    return this.db.transaction(async (trx) => {
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

      return this.scheduledTransactionRepository.update(
        id,
        workspaceId,
        { nextDate },
        trx,
      );
    });
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
}
