import { BadRequestException } from '@nestjs/common';
import { BankAccountEntity } from '../entities/bank-account.entity';

/** Contas arquivadas mantêm o histórico, mas não recebem novos lançamentos. */
export function assertAccountActive(account: Pick<BankAccountEntity, 'name' | 'archivedAt'>): void {
  if (account.archivedAt) {
    throw new BadRequestException(
      `A conta "${account.name}" está arquivada. Desarquive-a para movimentá-la.`,
    );
  }
}
