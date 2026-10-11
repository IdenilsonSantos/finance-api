import { NotificationsService } from './notifications.service';

describe('NotificationsService.notifyWorkspace', () => {
  function setup(prefsByUser: Record<string, boolean>) {
    const service = new NotificationsService({} as any, {} as any, {} as any);
    jest.spyOn(service as any, 'workspaceRecipients').mockResolvedValue([
      { userId: 'owner', email: 'owner@x.com' },
      { userId: 'member', email: 'member@x.com' },
    ]);
    const create = jest.spyOn(service as any, 'createNotification').mockResolvedValue(undefined);
    jest
      .spyOn(service, 'getPrefs')
      .mockImplementation(async (userId: string) => ({ billReminder: prefsByUser[userId] }) as any);
    return { service, create };
  }

  it('cria a notificação para todos os membros do workspace', async () => {
    const { service, create } = setup({ owner: true, member: true });
    const send = jest.fn().mockResolvedValue(undefined);

    await service.notifyWorkspace('ws-1', 'billReminder', { title: 't', body: 'b' }, send);

    expect(create).toHaveBeenCalledWith('owner', 'billReminder', 't', 'b');
    expect(create).toHaveBeenCalledWith('member', 'billReminder', 't', 'b');
    expect(send).toHaveBeenCalledWith('owner@x.com');
    expect(send).toHaveBeenCalledWith('member@x.com');
  });

  it('respeita a preferência de e-mail de cada membro', async () => {
    const { service } = setup({ owner: true, member: false });
    const send = jest.fn().mockResolvedValue(undefined);

    await service.notifyWorkspace('ws-1', 'billReminder', { title: 't', body: 'b' }, send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('owner@x.com');
  });
});
