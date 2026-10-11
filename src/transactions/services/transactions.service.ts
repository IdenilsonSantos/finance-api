import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { addMonths } from 'date-fns';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ITransactionRepository } from '../../core/repositories/transaction.repository.interface';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  ListTransactionsDto,
  TransactionsSummaryDto,
} from '../dto/transaction.dto';
import { TransactionEntity } from '../../core/entities/transaction.entity';
import { assertAccountActive } from '../../core/utils/accounts';
import { parseISODate, toISODate, withClampedDay } from '../../core/utils/date';
import { ActivityService } from '../../activity/activity.service';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(ITransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly activityService: ActivityService,
  ) {}

  async create(dto: CreateTransactionDto, workspaceId: string, userId: string) {
    const account = await this.bankAccountRepository.findById(
      dto.bankAccountId,
      workspaceId,
    );
    if (!account) throw new NotFoundException('Conta bancária não encontrada');
    assertAccountActive(account);

    const { installments = 1, ...data } = dto;
    if (installments > 1 && (account.type !== 'credit_card' || dto.type !== 'expense')) {
      throw new BadRequestException('Parcelamento disponível apenas para despesas no cartão de crédito');
    }

    const amountInCents = Math.round(dto.amount * 100);
    if (installments > amountInCents) {
      throw new BadRequestException('Valor insuficiente para o número de parcelas');
    }

    const tx = await this.db.transaction(async (trx) => {
      const rows = this.buildInstallments(data, amountInCents, installments, workspaceId);
      const created: TransactionEntity[] = [];
      for (const row of rows) {
        created.push(await this.transactionRepository.create(row, trx));
      }

      // Compra parcelada compromete o limite total de uma vez, como no banco.
      const delta = dto.type === 'income' ? amountInCents : -amountInCents;
      await this.bankAccountRepository.updateBalance(dto.bankAccountId, delta, trx);

      return created[0];
    });

    this.activityService.log({
      workspaceId,
      userId,
      action: 'transaction.created',
      entityType: 'transaction',
      entityId: tx.id,
      metadata: {
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
      },
    });

    return tx;
  }

  async findAll(workspaceId: string, filters: ListTransactionsDto) {
    return this.transactionRepository.findAllByWorkspace(workspaceId, {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      type: filters.type,
      category: filters.category,
      accountId: filters.accountId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      search: filters.search,
    });
  }

  /**
   * Divide o valor total em parcelas mensais. Centavos que sobram da divisão
   * vão para a primeira parcela (como fazem as operadoras).
   */
  private buildInstallments(
    data: Omit<CreateTransactionDto, 'installments'>,
    totalInCents: number,
    installments: number,
    workspaceId: string,
  ): Partial<TransactionEntity>[] {
    if (installments <= 1) {
      return [{ ...data, amount: totalInCents, workspaceId }];
    }

    const base = Math.floor(totalInCents / installments);
    const remainder = totalInCents - base * installments;
    const groupId = randomUUID();
    const purchaseDate = parseISODate(data.date);
    const anchorDay = purchaseDate.getDate();

    return Array.from({ length: installments }, (_, i) => ({
      ...data,
      workspaceId,
      amount: base + (i === 0 ? remainder : 0),
      date: toISODate(withClampedDay(addMonths(purchaseDate, i), anchorDay)),
      installmentGroupId: groupId,
      installmentNumber: i + 1,
      installmentTotal: installments,
    }));
  }

  async summary(workspaceId: string, filters: TransactionsSummaryDto) {
    return this.transactionRepository.summarize(workspaceId, {
      startDate: filters.startDate,
      endDate: filters.endDate,
      accountId: filters.accountId,
    });
  }

  async findOne(id: string, workspaceId: string) {
    const tx = await this.transactionRepository.findById(id, workspaceId);
    if (!tx) throw new NotFoundException('Transação não encontrada');
    return tx;
  }

  async update(id: string, workspaceId: string, dto: UpdateTransactionDto, userId: string) {
    const old = await this.findOne(id, workspaceId);

    // Sem esta checagem, mover a transação para uma conta de outro workspace
    // alteraria o saldo dela (updateBalance não filtra por workspace).
    const oldAccount = await this.bankAccountRepository.findById(old.bankAccountId, workspaceId);
    if (oldAccount) assertAccountActive(oldAccount);
    if (dto.bankAccountId && dto.bankAccountId !== old.bankAccountId) {
      const target = await this.bankAccountRepository.findById(dto.bankAccountId, workspaceId);
      if (!target) throw new NotFoundException('Conta bancária não encontrada');
      assertAccountActive(target);
    }

    const newBankAccountId = dto.bankAccountId ?? old.bankAccountId;
    const newAmountInCents = dto.amount !== undefined ? Math.round(dto.amount * 100) : old.amount;
    const newType = dto.type ?? old.type;

    const updated = await this.db.transaction(async (trx) => {
      const oldDelta = old.type === 'income' ? -old.amount : old.amount;
      await this.bankAccountRepository.updateBalance(old.bankAccountId, oldDelta, trx);

      const newDelta = newType === 'income' ? newAmountInCents : -newAmountInCents;
      await this.bankAccountRepository.updateBalance(newBankAccountId, newDelta, trx);

      return this.transactionRepository.update(
        id,
        workspaceId,
        {
          ...dto,
          amount: newAmountInCents,
          bankAccountId: newBankAccountId,
          type: newType,
        },
        trx,
      );
    });

    this.activityService.log({
      workspaceId,
      userId,
      action: 'transaction.updated',
      entityType: 'transaction',
      entityId: id,
      metadata: { description: updated.description, amount: updated.amount },
    });

    return updated;
  }

  async remove(
    id: string,
    workspaceId: string,
    userId: string,
    scope: 'single' | 'installments' = 'single',
  ) {
    const tx = await this.findOne(id, workspaceId);
    const account = await this.bankAccountRepository.findById(tx.bankAccountId, workspaceId);
    if (account) assertAccountActive(account);

    const targets =
      scope === 'installments' && tx.installmentGroupId
        ? await this.transactionRepository.findByInstallmentGroup(tx.installmentGroupId, workspaceId)
        : [tx];

    await this.db.transaction(async (trx) => {
      for (const t of targets) {
        await this.transactionRepository.delete(t.id, workspaceId, trx);
        const delta = t.type === 'income' ? -t.amount : t.amount;
        await this.bankAccountRepository.updateBalance(t.bankAccountId, delta, trx);
      }
    });

    this.activityService.log({
      workspaceId,
      userId,
      action: 'transaction.deleted',
      entityType: 'transaction',
      entityId: id,
      metadata: { description: tx.description },
    });
  }
}
