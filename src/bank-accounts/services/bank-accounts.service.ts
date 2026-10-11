import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { and, count, eq, gt, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import { ITransactionRepository } from '../../core/repositories/transaction.repository.interface';
import { ADJUSTMENT_CATEGORY } from '../../core/entities/transaction.entity';
import { todayISO } from '../../core/utils/date';
import { invoiceMonthForDate, invoicePeriod, invoiceRemaining } from '../../core/utils/credit-card';
import { BankAccountEntity, BankAccountType } from '../../core/entities/bank-account.entity';
import {
  AdjustBalanceDto,
  CreateBankAccountDto,
  InvoiceQueryDto,
  UpdateBankAccountDto,
} from '../dto/bank-account.dto';

type CardFields = Pick<BankAccountEntity, 'creditLimit' | 'closingDay' | 'dueDay'>;

export type InvoiceStatus = 'open' | 'closed' | 'paid' | 'overdue';
import { ActivityService } from '../../activity/activity.service';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

@Injectable()
export class BankAccountsService {
  constructor(
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
    @Inject(ITransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly activityService: ActivityService,
  ) {}

  /**
   * Normaliza os campos de cartão: obrigatórios (fechamento/vencimento) para
   * `credit_card` e zerados para os demais tipos.
   */
  private resolveCardFields(type: BankAccountType, fields: Partial<CardFields>): CardFields {
    if (type !== 'credit_card') {
      return { creditLimit: null, closingDay: null, dueDay: null };
    }
    if (!fields.closingDay || !fields.dueDay) {
      throw new BadRequestException(
        'Informe o dia de fechamento e o dia de vencimento da fatura do cartão',
      );
    }
    return {
      creditLimit: fields.creditLimit ?? null,
      closingDay: fields.closingDay,
      dueDay: fields.dueDay,
    };
  }

  async create(dto: CreateBankAccountDto, workspaceId: string, userId: string) {
    const { initialBalance, creditLimit, closingDay, dueDay, ...rest } = dto;
    const type = rest.type ?? 'checking';
    const cardFields = this.resolveCardFields(type, { creditLimit, closingDay, dueDay });

    const account = await this.db.transaction(async (trx) => {
      const created = await this.bankAccountRepository.create(
        { ...rest, ...cardFields, type, workspaceId, balance: 0, color: rest.color ?? '#6366f1' },
        trx,
      );

      // O saldo inicial vira um lançamento de ajuste ("Saldo inicial"), como
      // fazem os apps de finanças: assim o saldo da conta sempre pode ser
      // reconstruído pelo histórico (conciliação de extrato depende disso).
      if (initialBalance) {
        await this.transactionRepository.create(
          {
            workspaceId,
            bankAccountId: created.id,
            amount: Math.abs(initialBalance),
            type: initialBalance > 0 ? 'income' : 'expense',
            category: ADJUSTMENT_CATEGORY,
            description: 'Saldo inicial',
            date: todayISO(),
          },
          trx,
        );
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
    const current = await this.findOne(id, workspaceId);
    const { creditLimit, closingDay, dueDay, ...rest } = dto;
    const type = rest.type ?? current.type;
    const cardFields = this.resolveCardFields(type, {
      creditLimit: creditLimit === undefined ? current.creditLimit : creditLimit,
      closingDay: closingDay ?? current.closingDay,
      dueDay: dueDay ?? current.dueDay,
    });
    const updated = await this.bankAccountRepository.update(id, workspaceId, {
      ...rest,
      ...cardFields,
    });

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

  /**
   * Corrige o saldo da conta para o valor informado ("Ajustar saldo"),
   * registrando a diferença como lançamento de ajuste — fora de receitas,
   * despesas e orçamentos.
   */
  async adjustBalance(id: string, workspaceId: string, dto: AdjustBalanceDto, userId: string) {
    const account = await this.findOne(id, workspaceId);
    const target = Math.round(dto.balance * 100);
    const diff = target - account.balance;
    if (diff === 0) return account;

    const updated = await this.db.transaction(async (trx) => {
      await this.transactionRepository.create(
        {
          workspaceId,
          bankAccountId: id,
          amount: Math.abs(diff),
          type: diff > 0 ? 'income' : 'expense',
          category: ADJUSTMENT_CATEGORY,
          description: dto.description?.trim() || 'Ajuste de saldo',
          date: dto.date ?? todayISO(),
        },
        trx,
      );
      return this.bankAccountRepository.updateBalance(id, diff, trx);
    });

    this.activityService.log({
      workspaceId,
      userId,
      action: 'bankAccount.balanceAdjusted',
      entityType: 'bankAccount',
      entityId: id,
      metadata: { name: account.name, from: account.balance, to: updated.balance },
    });

    return updated;
  }

  /**
   * Arquiva a conta: some dos seletores e da visão geral, mas o histórico
   * continua nos relatórios. Exige saldo zerado (como nos apps de finanças),
   * para que o patrimônio total continue correto.
   */
  async archive(id: string, workspaceId: string, userId: string) {
    const account = await this.findOne(id, workspaceId);
    if (account.archivedAt) return account;

    if (account.balance !== 0) {
      throw new BadRequestException(
        'Zere o saldo da conta (com uma transferência ou ajuste de saldo) antes de arquivá-la',
      );
    }

    const [{ pending }] = await this.db
      .select({ pending: count() })
      .from(schema.scheduledTransaction)
      .where(eq(schema.scheduledTransaction.bankAccountId, id));
    if (Number(pending) > 0) {
      throw new BadRequestException(
        'Esta conta tem agendamentos ativos. Remova-os ou mova-os para outra conta antes de arquivar.',
      );
    }

    const updated = await this.bankAccountRepository.update(id, workspaceId, {
      archivedAt: new Date(),
    });

    this.activityService.log({
      workspaceId,
      userId,
      action: 'bankAccount.archived',
      entityType: 'bankAccount',
      entityId: id,
      metadata: { name: account.name },
    });

    return updated;
  }

  async unarchive(id: string, workspaceId: string, userId: string) {
    const account = await this.findOne(id, workspaceId);
    if (!account.archivedAt) return account;

    const updated = await this.bankAccountRepository.update(id, workspaceId, { archivedAt: null });

    this.activityService.log({
      workspaceId,
      userId,
      action: 'bankAccount.unarchived',
      entityType: 'bankAccount',
      entityId: id,
      metadata: { name: account.name },
    });

    return updated;
  }

  /**
   * Fatura do cartão de crédito. O pagamento é registrado como transferência
   * de outra conta para o cartão e abate as faturas mais antigas primeiro
   * (ver invoiceRemaining), independentemente da data da transferência.
   */
  async getInvoice(id: string, workspaceId: string, query: InvoiceQueryDto) {
    const account = await this.findOne(id, workspaceId);
    if (account.type !== 'credit_card' || !account.closingDay || !account.dueDay) {
      throw new BadRequestException('Fatura disponível apenas para cartões de crédito');
    }

    const cycle = { closingDay: account.closingDay, dueDay: account.dueDay };
    const today = todayISO();
    const month = query.month ?? invoiceMonthForDate(today, cycle);
    const period = invoicePeriod(month, cycle);

    const transactions = (
      await this.transactionRepository.findByBankAccountInDateRange(id, period.start, period.end)
    )
      .filter((t) => t.category !== ADJUSTMENT_CATEGORY)
      .sort((a, b) => b.date.localeCompare(a.date));

    const total = transactions.reduce(
      (acc, t) => acc + (t.type === 'expense' ? t.amount : -t.amount),
      0,
    );

    // Compras (menos estornos) lançadas depois do período desta fatura: são a
    // parte da dívida atual que pertence às faturas seguintes.
    const [after] = await this.db
      .select({
        net: sql<string>`coalesce(sum(case when ${schema.transaction.type} = 'expense' then ${schema.transaction.amount} else -${schema.transaction.amount} end), 0)`,
      })
      .from(schema.transaction)
      .where(and(eq(schema.transaction.bankAccountId, id), gt(schema.transaction.date, period.end)));

    const outstanding = Math.max(0, -account.balance);
    const remaining = invoiceRemaining(total, outstanding, Number(after?.net ?? 0));
    const paidAmount = Math.max(0, total) - remaining;

    let status: InvoiceStatus;
    if (today < period.closingDate) status = 'open';
    else if (remaining === 0) status = 'paid';
    else if (today > period.dueDate) status = 'overdue';
    else status = 'closed';

    const usedLimit = Math.max(0, -account.balance);

    return {
      ...period,
      status,
      total,
      paidAmount,
      remaining,
      creditLimit: account.creditLimit,
      usedLimit,
      availableLimit:
        account.creditLimit !== null ? Math.max(0, account.creditLimit - usedLimit) : null,
      transactions,
    };
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
