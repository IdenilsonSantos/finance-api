import { pgTable, text, timestamp, uuid, integer, date, uniqueIndex, boolean, jsonb, index } from 'drizzle-orm/pg-core';

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

export const refreshToken = pgTable('refreshToken', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  tokenHash: text('tokenHash').notNull().unique(),
  expiresAt: timestamp('expiresAt').notNull(),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const workspace = pgTable('workspace', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  image: text('image'),
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
  beneficiary: text('beneficiary'),
  category: text('category').notNull(),
  paymentMethod: text('paymentMethod'),
  date: date('date').notNull(),
  externalId: text('externalId'), // FITID do OFX para deduplicação
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const scheduledTransaction = pgTable('scheduledTransaction', {
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
  frequency: text('frequency', {
    enum: ['once', 'daily', 'weekly', 'monthly', 'yearly'],
  }).notNull(),
  nextDate: date('nextDate').notNull(),
  endDate: date('endDate'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const budget = pgTable(
  'budget',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspaceId')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    amount: integer('amount').notNull(),
    month: text('month').notNull(), // YYYY-MM
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('budget_workspace_category_month_idx').on(
      table.workspaceId,
      table.category,
      table.month,
    ),
  ],
);

export const goal = pgTable('goal', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetAmount: integer('targetAmount').notNull(), // cents
  currentAmount: integer('currentAmount').notNull().default(0), // cents
  deadline: date('deadline'),
  color: text('color').notNull().default('#6366f1'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const notification = pgTable('notification', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const notificationPrefs = pgTable('notificationPrefs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  prefs: jsonb('prefs').notNull().default({}),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const transfer = pgTable('transfer', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  fromAccountId: uuid('fromAccountId')
    .notNull()
    .references(() => bankAccount.id, { onDelete: 'cascade' }),
  toAccountId: uuid('toAccountId')
    .notNull()
    .references(() => bankAccount.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  description: text('description'),
  date: date('date').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const workspaceInvite = pgTable('workspaceInvite', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  invitedEmail: text('invitedEmail').notNull(),
  role: text('role', { enum: ['admin', 'member'] })
    .notNull()
    .default('member'),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expiresAt').notNull(),
  acceptedAt: timestamp('acceptedAt'),
  createdBy: uuid('createdBy')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const categoryRule = pgTable(
  'categoryRule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: text('category').notNull(),
    keyword: text('keyword').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (t) => [index('categoryRule_category_idx').on(t.category)],
);

export const statementImport = pgTable('statementImport', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspaceId')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  bankAccountId: uuid('bankAccountId')
    .notNull()
    .references(() => bankAccount.id, { onDelete: 'cascade' }),
  fileHash: text('fileHash').notNull(),
  filename: text('filename'),
  imported: integer('imported').notNull().default(0),
  duplicates: integer('duplicates').notNull().default(0),
  total: integer('total').notNull().default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const adminUser = pgTable('adminUser', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});
