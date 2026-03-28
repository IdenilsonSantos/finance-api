import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ITransactionRepository } from '../../core/repositories/transaction.repository.interface';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import { CreateTransactionDto, UpdateTransactionDto, ListTransactionsDto } from '../dto/transaction.dto';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

const FREE_PLAN_TRANSACTION_LIMIT = 50;

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(ITransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(dto: CreateTransactionDto, workspaceId: string) {
    const now = new Date();
    const count = await this.transactionRepository.countByWorkspaceAndMonth(
      workspaceId,
      now.getFullYear(),
      now.getMonth() + 1,
    );

    /* if (count >= FREE_PLAN_TRANSACTION_LIMIT) {
      throw new ForbiddenException(
        'Limite de transações do plano atingido. Faça upgrade para continuar.',
      );
    } */

    const account = await this.bankAccountRepository.findById(
      dto.bankAccountId,
      workspaceId,
    );
    if (!account) throw new NotFoundException('Conta bancária não encontrada');

    const amountInCents = Math.round(dto.amount * 100);

    return this.db.transaction(async (trx) => {
      const tx = await this.transactionRepository.create(
        { ...dto, amount: amountInCents, workspaceId },
        trx,
      );

      const delta = dto.type === 'income' ? amountInCents : -amountInCents;
      await this.bankAccountRepository.updateBalance(dto.bankAccountId, delta, trx);

      return tx;
    });
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

  async findOne(id: string, workspaceId: string) {
    const tx = await this.transactionRepository.findById(id, workspaceId);
    if (!tx) throw new NotFoundException('Transação não encontrada');
    return tx;
  }

  async update(id: string, workspaceId: string, dto: UpdateTransactionDto) {
    const old = await this.findOne(id, workspaceId);

    const newBankAccountId = dto.bankAccountId ?? old.bankAccountId;
    const newAmountInCents = dto.amount !== undefined ? Math.round(dto.amount * 100) : old.amount;
    const newType = dto.type ?? old.type;

    return this.db.transaction(async (trx) => {
      // Reverse old balance
      const oldDelta = old.type === 'income' ? -old.amount : old.amount;
      await this.bankAccountRepository.updateBalance(old.bankAccountId, oldDelta, trx);

      // Apply new balance
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
  }

  async remove(id: string, workspaceId: string) {
    const tx = await this.findOne(id, workspaceId);

    return this.db.transaction(async (trx) => {
      await this.transactionRepository.delete(id, workspaceId, trx);

      const delta = tx.type === 'income' ? -tx.amount : tx.amount;
      await this.bankAccountRepository.updateBalance(tx.bankAccountId, delta, trx);
    });
  }
}
