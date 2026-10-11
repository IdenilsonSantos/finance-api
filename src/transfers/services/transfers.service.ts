import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ITransferRepository } from '../../core/repositories/transfer.repository.interface';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ActivityService } from '../../activity/activity.service';
import { CreateTransferDto, ListTransfersDto, UpdateTransferDto } from '../dto/transfer.dto';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';
import { assertAccountActive } from '../../core/utils/accounts';

@Injectable()
export class TransfersService {
  constructor(
    @Inject(ITransferRepository)
    private readonly transferRepository: ITransferRepository,
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly notificationsService: NotificationsService,
    private readonly activityService: ActivityService,
  ) {}

  async create(dto: CreateTransferDto, workspaceId: string, userId: string) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException(
        'As contas de origem e destino devem ser diferentes',
      );
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.bankAccountRepository.findById(dto.fromAccountId, workspaceId),
      this.bankAccountRepository.findById(dto.toAccountId, workspaceId),
    ]);

    if (!fromAccount) throw new NotFoundException('Conta de origem não encontrada');
    if (!toAccount) throw new NotFoundException('Conta de destino não encontrada');
    assertAccountActive(fromAccount);
    assertAccountActive(toAccount);

    const amountInCents = Math.round(dto.amount * 100);

    const transfer = await this.db.transaction(async (trx) => {
      const t = await this.transferRepository.create(
        { ...dto, amount: amountInCents, workspaceId },
        trx,
      );
      await this.bankAccountRepository.updateBalance(dto.fromAccountId, -amountInCents, trx);
      await this.bankAccountRepository.updateBalance(dto.toAccountId, amountInCents, trx);
      return t;
    });

    const amountFmt = (amountInCents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    await this.notificationsService.notifyWorkspace(
      workspaceId,
      'transferCreated',
      {
        title: `Transferência realizada`,
        body: `${amountFmt} de ${fromAccount.name} → ${toAccount.name}`,
      },
      (email) =>
        this.notificationsService.sendTransferCreated({
          to: email,
          fromAccount: fromAccount.name,
          toAccount: toAccount.name,
          amount: amountInCents,
          date: transfer.date,
        }),
    );

    this.activityService.log({
      workspaceId,
      userId,
      action: 'transfer.created',
      entityType: 'transfer',
      entityId: transfer.id,
      metadata: {
        amount: transfer.amount,
        fromAccount: fromAccount.name,
        toAccount: toAccount.name,
      },
    });

    return transfer;
  }

  async findAll(workspaceId: string, filters: ListTransfersDto) {
    return this.transferRepository.findAllByWorkspace(workspaceId, {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      startDate: filters.startDate,
      endDate: filters.endDate,
      accountId: filters.accountId,
    });
  }

  async findOne(id: string, workspaceId: string) {
    const transfer = await this.transferRepository.findById(id, workspaceId);
    if (!transfer) throw new NotFoundException('Transferência não encontrada');
    return transfer;
  }

  /**
   * Edita uma transferência: desfaz o movimento antigo nas duas contas e
   * aplica o novo, numa única transação de banco.
   */
  async update(id: string, workspaceId: string, dto: UpdateTransferDto, userId: string) {
    const old = await this.findOne(id, workspaceId);
    const fromAccountId = dto.fromAccountId ?? old.fromAccountId;
    const toAccountId = dto.toAccountId ?? old.toAccountId;
    if (fromAccountId === toAccountId) {
      throw new BadRequestException('As contas de origem e destino devem ser diferentes');
    }

    const ids = [...new Set([old.fromAccountId, old.toAccountId, fromAccountId, toAccountId])];
    const accounts = await Promise.all(ids.map((accountId) => this.bankAccountRepository.findById(accountId, workspaceId)));
    ids.forEach((accountId, i) => {
      const account = accounts[i];
      if (!account) {
        throw new NotFoundException(
          accountId === toAccountId ? 'Conta de destino não encontrada' : 'Conta de origem não encontrada',
        );
      }
      assertAccountActive(account);
    });

    const amount = dto.amount !== undefined ? Math.round(dto.amount * 100) : old.amount;

    const updated = await this.db.transaction(async (trx) => {
      await this.bankAccountRepository.updateBalance(old.fromAccountId, old.amount, trx);
      await this.bankAccountRepository.updateBalance(old.toAccountId, -old.amount, trx);
      await this.bankAccountRepository.updateBalance(fromAccountId, -amount, trx);
      await this.bankAccountRepository.updateBalance(toAccountId, amount, trx);
      return this.transferRepository.update(
        id,
        workspaceId,
        {
          fromAccountId,
          toAccountId,
          amount,
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.date !== undefined ? { date: dto.date } : {}),
        },
        trx,
      );
    });

    this.activityService.log({
      workspaceId,
      userId,
      action: 'transfer.updated',
      entityType: 'transfer',
      entityId: id,
      metadata: { from: old.amount, to: updated.amount },
    });

    return updated;
  }

  async remove(id: string, workspaceId: string, userId: string) {
    const transfer = await this.findOne(id, workspaceId);
    const accounts = await Promise.all([
      this.bankAccountRepository.findById(transfer.fromAccountId, workspaceId),
      this.bankAccountRepository.findById(transfer.toAccountId, workspaceId),
    ]);
    accounts.forEach((a) => a && assertAccountActive(a));

    await this.db.transaction(async (trx) => {
      await this.transferRepository.delete(id, workspaceId, trx);
      await this.bankAccountRepository.updateBalance(transfer.fromAccountId, transfer.amount, trx);
      await this.bankAccountRepository.updateBalance(transfer.toAccountId, -transfer.amount, trx);
    });

    this.activityService.log({
      workspaceId,
      userId,
      action: 'transfer.deleted',
      entityType: 'transfer',
      entityId: id,
      metadata: { amount: transfer.amount },
    });
  }
}
