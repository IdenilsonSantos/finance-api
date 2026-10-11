import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { IBudgetRepository } from '../../core/repositories/budget.repository.interface';
import { ActivityService } from '../../activity/activity.service';
import { CopyBudgetsDto, CreateBudgetDto, UpdateBudgetDto } from '../dto/budget.dto';

@Injectable()
export class BudgetsService {
  constructor(
    @Inject(IBudgetRepository)
    private readonly budgetRepository: IBudgetRepository,
    private readonly activityService: ActivityService,
  ) {}

  async create(dto: CreateBudgetDto, workspaceId: string, userId: string) {
    const existing = await this.budgetRepository.findAllByWorkspace(
      workspaceId,
      dto.month,
    );
    const duplicate = existing.find((b) => b.category === dto.category);
    if (duplicate) {
      const [year, month] = dto.month.split('-');
      throw new ConflictException(
        `Já existe um orçamento para "${dto.category}" em ${month}/${year}`,
      );
    }

    const amountInCents = Math.round(dto.amount * 100);
    const budget = await this.budgetRepository.create({ ...dto, amount: amountInCents, workspaceId });

    this.activityService.log({
      workspaceId,
      userId,
      action: 'budget.created',
      entityType: 'budget',
      entityId: budget.id,
      metadata: { category: budget.category, amount: budget.amount, month: budget.month },
    });

    return budget;
  }

  /**
   * Repete os orçamentos de um mês em outro ("copiar mês anterior"). Categorias
   * que já têm orçamento no destino são mantidas.
   */
  async copy(dto: CopyBudgetsDto, workspaceId: string, userId: string) {
    if (dto.fromMonth === dto.toMonth) {
      throw new BadRequestException('Os meses de origem e destino devem ser diferentes');
    }

    const [source, target] = await Promise.all([
      this.budgetRepository.findAllByWorkspace(workspaceId, dto.fromMonth),
      this.budgetRepository.findAllByWorkspace(workspaceId, dto.toMonth),
    ]);
    if (source.length === 0) {
      throw new NotFoundException('Não há orçamentos no mês de origem');
    }

    const existing = new Set(target.map((b) => b.category));
    const toCreate = source.filter((b) => !existing.has(b.category));

    const created = await Promise.all(
      toCreate.map((b) =>
        this.budgetRepository.create({
          workspaceId,
          category: b.category,
          amount: b.amount,
          month: dto.toMonth,
        }),
      ),
    );

    if (created.length > 0) {
      this.activityService.log({
        workspaceId,
        userId,
        action: 'budget.copied',
        entityType: 'budget',
        entityId: dto.toMonth,
        metadata: { fromMonth: dto.fromMonth, toMonth: dto.toMonth, count: created.length },
      });
    }

    return { created: created.length, skipped: source.length - created.length };
  }

  async getSummary(workspaceId: string, month: string) {
    return this.budgetRepository.getSummary(workspaceId, month);
  }

  async findAll(workspaceId: string, month?: string) {
    return this.budgetRepository.findAllByWorkspace(workspaceId, month);
  }

  async findOne(id: string, workspaceId: string) {
    const budget = await this.budgetRepository.findById(id, workspaceId);
    if (!budget) throw new NotFoundException('Orçamento não encontrado');
    return budget;
  }

  async update(id: string, workspaceId: string, dto: UpdateBudgetDto, userId: string) {
    const existing = await this.findOne(id, workspaceId);
    const data: Record<string, any> = {};
    if (dto.amount !== undefined) data.amount = Math.round(dto.amount * 100);
    const updated = await this.budgetRepository.update(id, workspaceId, data);

    this.activityService.log({
      workspaceId,
      userId,
      action: 'budget.updated',
      entityType: 'budget',
      entityId: id,
      metadata: { category: existing.category, amount: updated.amount },
    });

    return updated;
  }

  async remove(id: string, workspaceId: string, userId: string) {
    const budget = await this.findOne(id, workspaceId);
    await this.budgetRepository.delete(id, workspaceId);

    this.activityService.log({
      workspaceId,
      userId,
      action: 'budget.deleted',
      entityType: 'budget',
      entityId: id,
      metadata: { category: budget.category },
    });
  }
}
