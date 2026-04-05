import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from '../dto/bank-account.dto';
import { ActivityService } from '../../activity/activity.service';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

@Injectable()
export class BankAccountsService {
  constructor(
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly activityService: ActivityService,
  ) {}

  async create(dto: CreateBankAccountDto, workspaceId: string, userId: string) {
    const { initialBalance, ...rest } = dto;

    const account = await this.db.transaction(async (trx) => {
      const created = await this.bankAccountRepository.create(
        { ...rest, workspaceId, balance: 0, color: rest.color ?? '#6366f1' },
        trx,
      );

      if (initialBalance && initialBalance > 0) {
        return this.bankAccountRepository.updateBalance(
          created.id,
          initialBalance,
          trx,
        );
      }

      return created;
    });

    this.activityService.log({
      workspaceId,
      userId,
      action: 'bankAccount.created',
      entityType: 'bankAccount',
      entityId: account.id,
      metadata: { name: account.name, type: account.type },
    });

    return account;
  }

  async findAll(workspaceId: string) {
    return this.bankAccountRepository.findAllByWorkspace(workspaceId);
  }

  async findOne(id: string, workspaceId: string) {
    const account = await this.bankAccountRepository.findById(id, workspaceId);
    if (!account) throw new NotFoundException('Conta bancária não encontrada');
    return account;
  }

  async update(id: string, workspaceId: string, dto: UpdateBankAccountDto, userId: string) {
    await this.findOne(id, workspaceId);
    const updated = await this.bankAccountRepository.update(id, workspaceId, dto);

    this.activityService.log({
      workspaceId,
      userId,
      action: 'bankAccount.updated',
      entityType: 'bankAccount',
      entityId: id,
      metadata: { name: updated.name },
    });

    return updated;
  }

  async remove(id: string, workspaceId: string, userId: string) {
    const account = await this.findOne(id, workspaceId);
    await this.bankAccountRepository.delete(id, workspaceId);

    this.activityService.log({
      workspaceId,
      userId,
      action: 'bankAccount.deleted',
      entityType: 'bankAccount',
      entityId: id,
      metadata: { name: account.name },
    });
  }
}
