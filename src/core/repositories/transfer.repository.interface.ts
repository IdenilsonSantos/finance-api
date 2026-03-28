import { TransferEntity } from '../entities/transfer.entity';
import { PaginatedResult } from '../dto/pagination.dto';

export const ITransferRepository = Symbol('ITransferRepository');

export interface ListTransfersFilters {
  page: number;
  limit: number;
  startDate?: string;
  endDate?: string;
  accountId?: string;
}

export interface ITransferRepository {
  findById(id: string, workspaceId: string): Promise<TransferEntity | null>;
  findAllByWorkspace(workspaceId: string, filters: ListTransfersFilters): Promise<PaginatedResult<TransferEntity>>;
  create(data: Partial<TransferEntity>, trx?: any): Promise<TransferEntity>;
  delete(id: string, workspaceId: string, trx?: any): Promise<void>;
}
