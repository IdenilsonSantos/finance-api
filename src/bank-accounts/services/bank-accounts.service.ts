import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from '../dto/bank-account.dto';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

@Injectable()
export class BankAccountsService {
  constructor(
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(dto: CreateBankAccountDto, workspaceId: string) {
    const { initialBalance, ...rest } = dto;

    return this.db.transaction(async (trx) => {
      const account = await this.bankAccountRepository.create(
        { ...rest, workspaceId, balance: 0, color: rest.color ?? '#6366f1' },
        trx,
      );

      if (initialBalance && initialBalance > 0) {
        await this.bankAccountRepository.updateBalance(
          account.id,
          initialBalance,
          trx,
        );
      }

      return account;
    });
  }

  async findAll(workspaceId: string) {
    return this.bankAccountRepository.findAllByWorkspace(workspaceId);
  }

  async findOne(id: string, workspaceId: string) {
    const account = await this.bankAccountRepository.findById(id, workspaceId);
    if (!account) throw new NotFoundException('Conta bancária não encontrada');
    return account;
  }

  async update(id: string, workspaceId: string, dto: UpdateBankAccountDto) {
    await this.findOne(id, workspaceId);
    return this.bankAccountRepository.update(id, workspaceId, dto);
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    await this.bankAccountRepository.delete(id, workspaceId);
  }
}
