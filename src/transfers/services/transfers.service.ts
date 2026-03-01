import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ITransferRepository } from '../../core/repositories/transfer.repository.interface';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import { CreateTransferDto } from '../dto/transfer.dto';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

@Injectable()
export class TransfersService {
  constructor(
    @Inject(ITransferRepository)
    private readonly transferRepository: ITransferRepository,
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(dto: CreateTransferDto, workspaceId: string) {
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

    const amountInCents = Math.round(dto.amount * 100);

    return this.db.transaction(async (trx) => {
      const transfer = await this.transferRepository.create(
        { ...dto, amount: amountInCents, workspaceId },
        trx,
      );

      await this.bankAccountRepository.updateBalance(dto.fromAccountId, -amountInCents, trx);
      await this.bankAccountRepository.updateBalance(dto.toAccountId, amountInCents, trx);

      return transfer;
    });
  }

  async findAll(workspaceId: string) {
    return this.transferRepository.findAllByWorkspace(workspaceId);
  }

  async findOne(id: string, workspaceId: string) {
    const transfer = await this.transferRepository.findById(id, workspaceId);
    if (!transfer) throw new NotFoundException('Transferência não encontrada');
    return transfer;
  }

  async remove(id: string, workspaceId: string) {
    const transfer = await this.findOne(id, workspaceId);

    return this.db.transaction(async (trx) => {
      await this.transferRepository.delete(id, workspaceId, trx);
      await this.bankAccountRepository.updateBalance(transfer.fromAccountId, transfer.amount, trx);
      await this.bankAccountRepository.updateBalance(transfer.toAccountId, -transfer.amount, trx);
    });
  }
}
