import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, ne, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';
import { categoryLabel, isBuiltinCategory } from '../../core/utils/categories';
import { CreateCategoryDto, DeleteCategoryQueryDto, UpdateCategoryDto } from '../dto/category.dto';

export type CategoryRow = typeof schema.category.$inferSelect;

/** Resolve o nome exibido de uma categoria (personalizada ou padrão). */
export type CategoryLabelResolver = (key: string) => string;

@Injectable()
export class CategoriesService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  findAll(workspaceId: string): Promise<CategoryRow[]> {
    return this.db
      .select()
      .from(schema.category)
      .where(eq(schema.category.workspaceId, workspaceId))
      .orderBy(schema.category.type, schema.category.name);
  }

  async findOne(id: string, workspaceId: string): Promise<CategoryRow> {
    const [row] = await this.db
      .select()
      .from(schema.category)
      .where(and(eq(schema.category.id, id), eq(schema.category.workspaceId, workspaceId)))
      .limit(1);
    if (!row) throw new NotFoundException('Categoria não encontrada');
    return row;
  }

  async create(dto: CreateCategoryDto, workspaceId: string): Promise<CategoryRow> {
    await this.assertNameAvailable(workspaceId, dto.type, dto.name);
    const [row] = await this.db
      .insert(schema.category)
      .values({
        workspaceId,
        name: dto.name,
        type: dto.type,
        color: dto.color ?? '#64748b',
        icon: dto.icon ?? 'tag',
      })
      .returning();
    return row;
  }

  async update(id: string, workspaceId: string, dto: UpdateCategoryDto): Promise<CategoryRow> {
    const current = await this.findOne(id, workspaceId);
    if (dto.name !== undefined) await this.assertNameAvailable(workspaceId, current.type, dto.name, id);
    const [row] = await this.db
      .update(schema.category)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(schema.category.id, id), eq(schema.category.workspaceId, workspaceId)))
      .returning();
    return row;
  }

  /**
   * Exclui a categoria movendo transações e agendamentos para `replaceWith`
   * (padrão "others"). Orçamentos dela são removidos (não há como somar dois
   * orçamentos do mesmo mês numa categoria só sem decidir pelo usuário).
   */
  async remove(id: string, workspaceId: string, query: DeleteCategoryQueryDto) {
    await this.findOne(id, workspaceId);
    const replaceWith = query.replaceWith ?? 'others';
    if (replaceWith === id) {
      throw new BadRequestException('Escolha outra categoria para receber os lançamentos');
    }
    if (!(await this.exists(replaceWith, workspaceId))) {
      throw new BadRequestException('Categoria de destino não encontrada');
    }

    return this.db.transaction(async (trx) => {
      const moved = await trx
        .update(schema.transaction)
        .set({ category: replaceWith, updatedAt: new Date() })
        .where(and(eq(schema.transaction.workspaceId, workspaceId), eq(schema.transaction.category, id)))
        .returning({ id: schema.transaction.id });
      await trx
        .update(schema.scheduledTransaction)
        .set({ category: replaceWith, updatedAt: new Date() })
        .where(
          and(
            eq(schema.scheduledTransaction.workspaceId, workspaceId),
            eq(schema.scheduledTransaction.category, id),
          ),
        );
      await trx
        .delete(schema.budget)
        .where(and(eq(schema.budget.workspaceId, workspaceId), eq(schema.budget.category, id)));
      await trx
        .delete(schema.category)
        .where(and(eq(schema.category.id, id), eq(schema.category.workspaceId, workspaceId)));
      return { movedTransactions: moved.length, replaceWith };
    });
  }

  /** Nomes das categorias do workspace: personalizadas primeiro, depois as padrão. */
  async labelResolver(workspaceId: string): Promise<CategoryLabelResolver> {
    const custom = await this.findAll(workspaceId);
    const names = new Map(custom.map((c) => [c.id, c.name]));
    return (key: string) => names.get(key) ?? categoryLabel(key);
  }

  private async exists(key: string, workspaceId: string): Promise<boolean> {
    if (isBuiltinCategory(key)) return true;
    if (!/^[0-9a-f-]{36}$/i.test(key)) return false;
    const [row] = await this.db
      .select({ id: schema.category.id })
      .from(schema.category)
      .where(and(eq(schema.category.id, key), eq(schema.category.workspaceId, workspaceId)))
      .limit(1);
    return !!row;
  }

  private async assertNameAvailable(workspaceId: string, type: string, name: string, exceptId?: string) {
    const conditions = [
      eq(schema.category.workspaceId, workspaceId),
      eq(schema.category.type, type as 'income' | 'expense'),
      sql`lower(${schema.category.name}) = lower(${name})`,
    ];
    if (exceptId) conditions.push(ne(schema.category.id, exceptId));
    const [dup] = await this.db
      .select({ id: schema.category.id })
      .from(schema.category)
      .where(and(...conditions))
      .limit(1);
    if (dup) throw new ConflictException(`Já existe uma categoria "${name}"`);
  }
}
