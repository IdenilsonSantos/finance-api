import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IGoalRepository } from '../../core/repositories/goal.repository.interface';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { CreateGoalDto, UpdateGoalDto, ContributeGoalDto, ListGoalsDto } from '../dto/goal.dto';

@Injectable()
export class GoalsService {
  constructor(
    @Inject(IGoalRepository)
    private readonly goalRepository: IGoalRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateGoalDto, workspaceId: string) {
    const targetAmount = Math.round(dto.targetAmount * 100);
    return this.goalRepository.create({
      ...dto,
      targetAmount,
      workspaceId,
    });
  }

  async findAll(workspaceId: string, filters: ListGoalsDto) {
    return this.goalRepository.findAllByWorkspace(workspaceId, {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      completed: filters.completed,
    });
  }

  async findOne(id: string, workspaceId: string) {
    const goal = await this.goalRepository.findById(id, workspaceId);
    if (!goal) throw new NotFoundException('Meta não encontrada');
    return goal;
  }

  async update(id: string, workspaceId: string, dto: UpdateGoalDto) {
    await this.findOne(id, workspaceId);

    const data: Record<string, any> = { ...dto };
    if (dto.targetAmount !== undefined) {
      data.targetAmount = Math.round(dto.targetAmount * 100);
    }

    return this.goalRepository.update(id, workspaceId, data);
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    await this.goalRepository.delete(id, workspaceId);
  }

  async contribute(id: string, workspaceId: string, dto: ContributeGoalDto) {
    const goal = await this.findOne(id, workspaceId);
    const delta = Math.round(dto.amount * 100);
    const newAmount = Math.min(goal.currentAmount + delta, goal.targetAmount);

    const updated = await this.goalRepository.update(id, workspaceId, {
      currentAmount: newAmount,
    });

    if (updated.currentAmount >= updated.targetAmount) {
      const amount = (updated.targetAmount / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      await this.notificationsService.notifyWorkspace(
        workspaceId,
        'goalAchieved',
        {
          title: `Meta "${updated.name}" atingida! 🎉`,
          body: `Parabéns! Você alcançou ${amount}.`,
        },
        (email) =>
          this.notificationsService.sendGoalCompleted({
            to: email,
            goalName: updated.name,
            targetAmount: updated.targetAmount,
          }),
      );
    }

    return updated;
  }
}
