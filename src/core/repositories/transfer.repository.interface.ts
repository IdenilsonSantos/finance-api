import { TransferEntity } from '../entities/transfer.entity';

export const ITransferRepository = Symbol('ITransferRepository');

export interface ITransferRepository {
  findById(id: string, workspaceId: string): Promise<TransferEntity | null>;
  findAllByWorkspace(workspaceId: string): Promise<TransferEntity[]>;
  create(data: Partial<TransferEntity>, trx?: any): Promise<TransferEntity>;
  delete(id: string, workspaceId: string, trx?: any): Promise<void>;
}
