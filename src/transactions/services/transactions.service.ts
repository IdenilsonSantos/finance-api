import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { addMonths } from 'date-fns';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ITransactionRepository } from '../../core/repositories/transaction.repository.interface';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import { ITransferRepository } from '../../core/repositories/transfer.repository.interface';
import { BankAccountEntity } from '../../core/entities/bank-account.entity';
import { InvestmentAccountsService } from '../../bank-accounts/services/investment-accounts.service';
import { CategoriesService } from '../../categories/services/categories.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  ListTransactionsDto,
  TransactionsSummaryDto,
  ConvertToTransferDto,
  ExportTransactionsDto,
} from '../dto/transaction.dto';
import { buildTransactionsCsv, EXPORT_MAX_ROWS } from '../utils/transactions-csv';
import {
  ADJUSTMENT_CATEGORY,
  TransactionEntity,
  balanceEffect,
} from '../../core/entities/transaction.entity';
import { BudgetAlertsService, BudgetChange } from '../../alerts/services/budget-alerts.service';
import { assertAccountActive } from '../../core/utils/accounts';
import { parseISODate, toISODate, todayISO, withClampedDay } from '../../core/utils/date';
import { ActivityService } from '../../activity/activity.service';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

/** Despesas (fora ajustes) viram variações de gasto por mês/categoria. */
function budgetChanges(
  txs: Pick<TransactionEntity, 'type' | 'category' | 'amount' | 'date'>[],
  sign: 1 | -1,
): BudgetChange[] {
  return txs
    .filter((t) => t.type === 'expense' && t.category !== ADJUSTMENT_CATEGORY)
    .map((t) => ({ month: t.date.slice(0, 7), category: t.category, delta: sign * t.amount }));
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @Inject(ITransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly activityService: ActivityService,
    private readonly budgetAlerts: BudgetAlertsService,
    private readonly investmentAccounts: InvestmentAccountsService,
    @Inject(ITransferRepository)
    private readonly transferRepository: ITransferRepository,
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * Alertas de orçamento rodam depois da operação já gravada: não podem
   * atrasar a resposta nem transformar um sucesso em erro.
   */
  private checkBudgets(workspaceId: string, buildChanges: () => BudgetChange[]) {
    const fail = (err: unknown) =>
      this.logger.error('Falha ao verificar orçamentos', err instanceof Error ? err.stack : String(err));
    try {
      const changes = buildChanges();
      if (changes.length === 0) return;
      this.budgetAlerts.checkThresholds(workspaceId, changes).catch(fail);
    } catch (err) {
      fail(err);
    }
  }

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
    const status = dto.status ?? 'paid';
    this.assertStatusAllowed(account.type, status);

    const amountInCents = Math.round(dto.amount * 100);
    if (installments > amountInCents) {
      throw new BadRequestException('Valor insuficiente para o número de parcelas');
    }

    const createdRows = await this.db.transaction(async (trx) => {
      const rows = this.buildInstallments({ ...data, status }, amountInCents, installments, workspaceId);
      const created: TransactionEntity[] = [];
      for (const row of rows) {
        created.push(await this.transactionRepository.create(row, trx));
      }

      // Compra parcelada compromete o limite total de uma vez, como no banco.
      // Contas pendentes só movimentam o saldo quando forem efetivadas.
      const delta = balanceEffect({ type: dto.type, amount: amountInCents, status });
      if (delta !== 0) {
        await this.bankAccountRepository.updateBalance(dto.bankAccountId, delta, trx);
      }

      return created;
    });
    const tx = createdRows[0];
    this.checkBudgets(workspaceId, () => budgetChanges(createdRows, 1));

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
      status: filters.status,
      order: filters.order,
    });
  }

  /**
   * Cartão de crédito não tem "pendente": a compra já consome o limite e entra
   * na fatura; o que fica a pagar é a própria fatura.
   */
  private assertStatusAllowed(accountType: string, status: string) {
    if (accountType === 'credit_card' && status === 'pending') {
      throw new BadRequestException(
        'Compras no cartão de crédito não podem ficar pendentes: elas entram na fatura',
      );
    }
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

  /** CSV das transações filtradas, em ordem cronológica (para planilhas). */
  async exportCsv(workspaceId: string, filters: ExportTransactionsDto): Promise<string> {
    const [result, accounts, labelOf] = await Promise.all([
      this.transactionRepository.findAllByWorkspace(workspaceId, {
        ...filters,
        page: 1,
        limit: EXPORT_MAX_ROWS,
        order: 'asc',
      }),
      this.bankAccountRepository.findAllByWorkspace(workspaceId),
      this.categoriesService.labelResolver(workspaceId),
    ]);
    return buildTransactionsCsv(result.data, new Map(accounts.map((a) => [a.id, a.name])), labelOf);
  }

  async summary(workspaceId: string, filters: TransactionsSummaryDto) {
    return this.transactionRepository.summarize(workspaceId, {
      startDate: filters.startDate,
      endDate: filters.endDate,
      accountId: filters.accountId,
      today: todayISO(),
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
    let targetAccount = oldAccount;
    if (dto.bankAccountId && dto.bankAccountId !== old.bankAccountId) {
      const target = await this.bankAccountRepository.findById(dto.bankAccountId, workspaceId);
      if (!target) throw new NotFoundException('Conta bancária não encontrada');
      assertAccountActive(target);
      targetAccount = target;
    }

    const newBankAccountId = dto.bankAccountId ?? old.bankAccountId;
    const newAmountInCents = dto.amount !== undefined ? Math.round(dto.amount * 100) : old.amount;
    const newType = dto.type ?? old.type;
    const newStatus = dto.status ?? old.status;
    if (targetAccount) this.assertStatusAllowed(targetAccount.type, newStatus);

    const updated = await this.db.transaction(async (trx) => {
      // Desfaz o efeito antigo e aplica o novo; pendentes não têm efeito, então
      // efetivar (pending -> paid) só aplica o valor agora.
      const oldDelta = -balanceEffect(old);
      if (oldDelta !== 0) {
        await this.bankAccountRepository.updateBalance(old.bankAccountId, oldDelta, trx);
      }

      const newDelta = balanceEffect({ type: newType, amount: newAmountInCents, status: newStatus });
      if (newDelta !== 0) {
        await this.bankAccountRepository.updateBalance(newBankAccountId, newDelta, trx);
      }

      return this.transactionRepository.update(
        id,
        workspaceId,
        {
          ...dto,
          amount: newAmountInCents,
          bankAccountId: newBankAccountId,
          type: newType,
          status: newStatus,
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

    this.checkBudgets(workspaceId, () => [
      ...budgetChanges([old], -1),
      ...budgetChanges([updated], 1),
    ]);

    return updated;
  }

  /**
   * Converte uma transação em transferência — ex.: "Aplicação RDB" importada
   * como despesa. Despesa vira saída para a outra conta; receita vira entrada
   * vinda dela. O saldo da conta da transação não muda (o valor já tinha
   * saído/entrado); só a outra ponta recebe o movimento. Sem conta informada,
   * usa a conta de investimento vinculada (criada se preciso).
   */
  async convertToTransfer(id: string, workspaceId: string, dto: ConvertToTransferDto, userId: string) {
    const tx = await this.findOne(id, workspaceId);
    const account = await this.bankAccountRepository.findById(tx.bankAccountId, workspaceId);
    if (!account) throw new NotFoundException('Conta bancária não encontrada');
    assertAccountActive(account);

    if (account.type === 'credit_card') {
      throw new BadRequestException('Lançamentos do cartão de crédito não podem virar transferência');
    }
    if (tx.status !== 'paid') {
      throw new BadRequestException('Marque a transação como paga antes de convertê-la em transferência');
    }
    if (tx.category === ADJUSTMENT_CATEGORY) {
      throw new BadRequestException('Ajustes de saldo não podem virar transferência');
    }
    if (tx.installmentGroupId) {
      throw new BadRequestException('Compras parceladas não podem virar transferência');
    }

    let counterpart: BankAccountEntity | null = null;
    if (dto.counterpartAccountId) {
      if (dto.counterpartAccountId === account.id) {
        throw new BadRequestException('Escolha uma conta diferente da conta da transação');
      }
      counterpart = await this.bankAccountRepository.findById(dto.counterpartAccountId, workspaceId);
      if (!counterpart) throw new NotFoundException('Conta de destino não encontrada');
      // Cartão como destino = pagamento de fatura (ex.: "Pagamento de fatura"
      // importado como despesa); como origem = "Pix no crédito".
      assertAccountActive(counterpart);
    }

    const isOutflow = tx.type === 'expense';
    const transfer = await this.db.transaction(async (trx) => {
      const target = counterpart ?? (await this.investmentAccounts.findOrCreate(account, trx));
      await this.transactionRepository.delete(tx.id, workspaceId, trx);
      const created = await this.transferRepository.create(
        {
          workspaceId,
          fromAccountId: isOutflow ? account.id : target.id,
          toAccountId: isOutflow ? target.id : account.id,
          amount: tx.amount,
          description: tx.description,
          date: tx.date,
          externalId: tx.externalId,
        },
        trx,
      );
      await this.bankAccountRepository.updateBalance(target.id, isOutflow ? tx.amount : -tx.amount, trx);
      return created;
    });

    this.activityService.log({
      workspaceId,
      userId,
      action: 'transfer.created',
      entityType: 'transfer',
      entityId: transfer.id,
      metadata: { amount: transfer.amount, convertedFromTransaction: id },
    });

    return transfer;
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
        const delta = -balanceEffect(t);
        if (delta !== 0) {
          await this.bankAccountRepository.updateBalance(t.bankAccountId, delta, trx);
        }
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
