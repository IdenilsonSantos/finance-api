import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IGoalRepository } from '../../core/repositories/goal.repository.interface';
import { IWorkspaceRepository } from '../../core/repositories/workspace.repository.interface';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { CreateGoalDto, UpdateGoalDto, ContributeGoalDto } from '../dto/goal.dto';

@Injectable()
export class GoalsService {
  constructor(
    @Inject(IGoalRepository)
    private readonly goalRepository: IGoalRepository,
    @Inject(IWorkspaceRepository)
    private readonly workspaceRepository: IWorkspaceRepository,
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

  async findAll(workspaceId: string) {
    return this.goalRepository.findAllByWorkspace(workspaceId);
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
      const ownerEmail = await this.workspaceRepository.findOwnerEmail(workspaceId);
      if (ownerEmail) {
        await this.notificationsService
          .sendGoalCompleted({
            to: ownerEmail,
            goalName: updated.name,
            targetAmount: updated.targetAmount,
          })
          .catch(() => {});
      }
    }

    return updated;
  }
}
