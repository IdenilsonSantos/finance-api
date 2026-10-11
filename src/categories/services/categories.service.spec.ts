import { BadRequestException, ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service';

/** Mock encadeável do drizzle: cada consulta resolve com o próximo resultado da fila. */
function dbMock(results: unknown[][]) {
  const queue = [...results];
  const next = () => Promise.resolve(queue.shift() ?? []);
  const chain: any = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'then') return (resolve: any, reject: any) => next().then(resolve, reject);
        return () => chain;
      },
    },
  );
  const db: any = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    transaction: async (cb: (trx: any) => Promise<unknown>) => cb(db),
  };
  return db;
}

const CAT = { id: '11111111-1111-1111-1111-111111111111', workspaceId: 'ws', name: 'Pets', type: 'expense' };

describe('CategoriesService', () => {
  it('recusa nome repetido no mesmo tipo', async () => {
    const service = new CategoriesService(dbMock([[{ id: 'dup' }]]));
    await expect(service.create({ name: 'Pets', type: 'expense' }, 'ws')).rejects.toBeInstanceOf(ConflictException);
  });

  it('exclusão move as transações para a categoria de destino', async () => {
    // findOne, update transaction (2 movidas), update scheduled, delete budget, delete category
    const service = new CategoriesService(dbMock([[CAT], [{ id: 'a' }, { id: 'b' }], [], [], []]));
    await expect(service.remove(CAT.id, 'ws', { replaceWith: 'food' })).resolves.toEqual({
      movedTransactions: 2,
      replaceWith: 'food',
    });
  });

  it('exclusão recusa destino inexistente', async () => {
    const service = new CategoriesService(dbMock([[CAT]]));
    await expect(service.remove(CAT.id, 'ws', { replaceWith: 'nao-existe' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('exclusão recusa mover para ela mesma', async () => {
    const service = new CategoriesService(dbMock([[CAT]]));
    await expect(service.remove(CAT.id, 'ws', { replaceWith: CAT.id })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('labelResolver usa o nome personalizado e cai nas padrão', async () => {
    const service = new CategoriesService(dbMock([[CAT]]));
    const label = await service.labelResolver('ws');
    expect(label(CAT.id)).toBe('Pets');
    expect(label('food')).toBe('Alimentação');
  });
});
