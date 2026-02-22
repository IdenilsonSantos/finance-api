export class UserEntity {
  id: string;
  name?: string | null;
  email: string;
  emailVerified?: Date | null;
  password: string;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
