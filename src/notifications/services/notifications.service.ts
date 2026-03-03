import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function formatMonth(yearMonth: string): string {
  return format(parseISO(`${yearMonth}-01`), "MMMM 'de' yyyy", { locale: ptBR });
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

@Injectable()
export class NotificationsService {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.resend = new Resend(config.getOrThrow('RESEND_API_KEY'));
    this.from = config.getOrThrow('EMAIL_FROM');
  }

  async sendScheduledTransactionExecuted(params: {
    to: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    date: string; // YYYY-MM-DD
  }) {
    const signal = params.type === 'income' ? '+' : '-';
    const amount = formatBRL(params.amount);
    const date = formatDate(params.date);
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: `Transação agendada executada: ${params.description}`,
      html: `<p>Sua transação agendada <strong>${params.description}</strong> foi executada em <strong>${date}</strong>.</p>
             <p>Valor: <strong>${signal}${amount}</strong></p>`,
    });
  }

  async sendTransferCreated(params: {
    to: string;
    fromAccount: string;
    toAccount: string;
    amount: number;
    date: string; // YYYY-MM-DD
  }) {
    const amount = formatBRL(params.amount);
    const date = formatDate(params.date);
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: `Transferência realizada: ${amount}`,
      html: `<p>Transferência de <strong>${params.fromAccount}</strong> para <strong>${params.toAccount}</strong>.</p>
             <p>Valor: <strong>${amount}</strong> em <strong>${date}</strong>.</p>`,
    });
  }

  async sendGoalCompleted(params: {
    to: string;
    goalName: string;
    targetAmount: number;
  }) {
    const amount = formatBRL(params.targetAmount);
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: `Meta atingida: ${params.goalName}`,
      html: `<p>Parabéns! Você atingiu sua meta <strong>${params.goalName}</strong> de <strong>${amount}</strong>!</p>`,
    });
  }

  async sendBudgetAlert(params: {
    to: string;
    category: string;
    percent: number;
    spentAmount: number;
    budgetAmount: number;
    month: string; // YYYY-MM
  }) {
    const spent = formatBRL(params.spentAmount);
    const budget = formatBRL(params.budgetAmount);
    const month = formatMonth(params.month);
    const isExceeded = params.percent >= 100;
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: isExceeded
        ? `Orçamento esgotado: ${params.category} em ${month}`
        : `Alerta de orçamento: ${params.category} está em ${params.percent}%`,
      html: `<p>Categoria <strong>${params.category}</strong> em <strong>${month}</strong>:</p>
             <p>Gasto: <strong>${spent}</strong> de <strong>${budget}</strong> (${params.percent}%)</p>`,
    });
  }

  async sendGoalDeadlineReminder(params: {
    to: string;
    goalName: string;
    deadline: string; // YYYY-MM-DD
    targetAmount: number;
    currentAmount: number;
    percentDone: number;
  }) {
    const target = formatBRL(params.targetAmount);
    const remaining = formatBRL(params.targetAmount - params.currentAmount);
    const deadline = formatDate(params.deadline);
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: `Lembrete de meta: ${params.goalName} vence em ${deadline}`,
      html: `<p>Sua meta <strong>${params.goalName}</strong> vence em <strong>${deadline}</strong>.</p>
             <p>Progresso: <strong>${params.percentDone}%</strong> de ${target}. Faltam <strong>${remaining}</strong>.</p>`,
    });
  }
}
