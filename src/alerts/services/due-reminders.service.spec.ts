import { buildBillsReminder, DueRemindersService, PendingBill, reminderDates } from './due-reminders.service';
import * as dateUtils from '../../core/utils/date';

const bill = (overrides: Partial<PendingBill>): PendingBill => ({
  workspaceId: 'ws-1',
  description: 'Aluguel',
  category: 'housing',
  amount: 150000,
  type: 'expense',
  date: '2024-03-10',
  ...overrides,
});

describe('reminderDates', () => {
  it('3 dias antes, hoje e ontem', () => {
    expect(reminderDates('2024-03-01')).toEqual({
      soon: '2024-03-04',
      today: '2024-03-01',
      overdue: '2024-02-29',
    });
  });
});

describe('buildBillsReminder', () => {
  it('uma conta vencendo hoje', () => {
    const r = buildBillsReminder([bill({ date: '2024-03-10' })], '2024-03-10');
    expect(r.title).toBe('Conta "Aluguel" vence hoje');
    expect(r.body).toBe('Aluguel (R$\u00a01.500,00, vence hoje).');
    expect(r.hasOverdue).toBe(false);
  });

  it('recebimento usa a categoria quando não há descrição', () => {
    const r = buildBillsReminder(
      [bill({ type: 'income', description: null, category: 'salary', date: '2024-03-13' })],
      '2024-03-10',
    );
    expect(r.title).toBe('Recebimento "Salário" vence em 3 dias');
  });

  it('várias contas: atrasadas primeiro e resumo limitado a 3', () => {
    const r = buildBillsReminder(
      [
        bill({ description: 'Internet', date: '2024-03-13' }),
        bill({ description: 'Luz', date: '2024-03-10' }),
        bill({ description: 'Água', date: '2024-03-09' }),
        bill({ description: 'Gás', date: '2024-03-13' }),
      ],
      '2024-03-10',
    );
    expect(r.hasOverdue).toBe(true);
    expect(r.title).toBe('4 contas precisam de atenção, incluindo atrasadas');
    expect(r.items.map((i) => i.description)).toEqual(['Água', 'Luz', 'Internet', 'Gás']);
    expect(r.body.endsWith(' e mais 1.')).toBe(true);
  });
});

describe('DueRemindersService.handleBillReminders', () => {
  it('envia um lembrete por workspace', async () => {
    jest.spyOn(dateUtils, 'todayISO').mockReturnValue('2024-03-10');
    const notifications = { notifyWorkspace: jest.fn().mockResolvedValue(undefined), sendBillsReminder: jest.fn() };
    const service = new DueRemindersService({} as any, notifications as any);
    const find = jest
      .spyOn(service as any, 'findPendingBills')
      .mockResolvedValue([bill({}), bill({ description: 'Luz' }), bill({ workspaceId: 'ws-2' })]);

    await service.handleBillReminders();

    expect(find).toHaveBeenCalledWith(['2024-03-13', '2024-03-10', '2024-03-09']);
    expect(notifications.notifyWorkspace).toHaveBeenCalledTimes(2);
    expect(notifications.notifyWorkspace).toHaveBeenCalledWith(
      'ws-1',
      'billReminder',
      expect.objectContaining({ title: '2 contas vencendo' }),
      expect.any(Function),
    );
  });
});
