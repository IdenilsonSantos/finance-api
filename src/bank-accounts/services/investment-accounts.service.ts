import { Inject, Injectable } from '@nestjs/common';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import { BankAccountEntity } from '../../core/entities/bank-account.entity';

const INVESTMENT_ACCOUNT_COLOR = '#a855f7';

/**
 * Cada conta (corrente, poupança...) tem uma conta de investimento vinculada,
 * criada na primeira aplicação: "Investimentos · <conta>". Aplicações e
 * resgates viram transferências entre as duas, como nos apps de finanças, em
 * vez de despesa/receita — o dinheiro continua no patrimônio.
 */
@Injectable()
export class InvestmentAccountsService {
  constructor(
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
  ) {}

  static nameFor(source: Pick<BankAccountEntity, 'name'>): string {
    return `Investimentos · ${source.name}`;
  }

  async findOrCreate(source: BankAccountEntity, trx?: any): Promise<BankAccountEntity> {
    const existing = await this.bankAccountRepository.findLinkedInvestmentAccount(
      source.id,
      source.workspaceId,
      trx,
    );
    if (existing) return existing;

    return this.bankAccountRepository.create(
      {
        workspaceId: source.workspaceId,
        name: InvestmentAccountsService.nameFor(source),
        type: 'investment',
        color: INVESTMENT_ACCOUNT_COLOR,
        balance: 0,
        linkedAccountId: source.id,
      },
      trx,
    );
  }
}
