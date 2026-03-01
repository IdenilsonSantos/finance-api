import { pgTable, text, timestamp, uuid, integer, date } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified'),
  password: text('password').notNull(),
  image: text('image'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const workspace = pgTable('workspace', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('ownerId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const workspaceMember = pgTable('workspaceMember', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'admin', 'member'] })
    .notNull()
    .default('member'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const bankAccount = pgTable('bankAccount', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['checking', 'savings', 'investment', 'cash'],
  })
    .notNull()
    .default('checking'),
  color: text('color').notNull().default('#6366f1'),
  balance: integer('balance').notNull().default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const transaction = pgTable('transaction', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  bankAccountId: uuid('bankAccountId')
    .notNull()
    .references(() => bankAccount.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  type: text('type', { enum: ['income', 'expense'] }).notNull(),
  description: text('description'),
  category: text('category').notNull(),
  date: date('date').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});
