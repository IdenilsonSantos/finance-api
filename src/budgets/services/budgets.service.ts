import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { IBudgetRepository } from '../../core/repositories/budget.repository.interface';
import { CreateBudgetDto, UpdateBudgetDto } from '../dto/budget.dto';

@Injectable()
export class BudgetsService {
  constructor(
    @Inject(IBudgetRepository)
    private readonly budgetRepository: IBudgetRepository,
  ) {}

  async create(dto: CreateBudgetDto, workspaceId: string) {
    const existing = await this.budgetRepository.findAllByWorkspace(
      workspaceId,
      dto.month,
    );
    const duplicate = existing.find((b) => b.category === dto.category);
    if (duplicate) {
      throw new ConflictException(
        `Já existe um orçamento para "${dto.category}" em ${dto.month}`,
      );
    }

    const amountInCents = Math.round(dto.amount * 100);
    return this.budgetRepository.create({ ...dto, amount: amountInCents, workspaceId });
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

  async update(id: string, workspaceId: string, dto: UpdateBudgetDto) {
    await this.findOne(id, workspaceId);
    const data: Record<string, any> = {};
    if (dto.amount !== undefined) data.amount = Math.round(dto.amount * 100);
    return this.budgetRepository.update(id, workspaceId, data);
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    await this.budgetRepository.delete(id, workspaceId);
  }
}
