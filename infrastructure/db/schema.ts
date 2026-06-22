import { pgTable, text, timestamp, boolean, unique, uuid, jsonb, date } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})

export const integration = pgTable('integration', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  provider: text('provider').notNull(),
  accessToken: text('accessToken').notNull(),
  refreshToken: text('refreshToken'),
  expiresAt: timestamp('expiresAt').notNull(),
  scope: text('scope'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
}, (t) => [unique().on(t.userId, t.provider)])

export const calendarSelection = pgTable('calendar_selection', {
  id: text('id').primaryKey(),
  integrationId: text('integrationId')
    .notNull()
    .references(() => integration.id, { onDelete: 'cascade' }),
  externalCalendarId: text('externalCalendarId').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('createdAt').notNull(),
}, (t) => [unique().on(t.integrationId, t.externalCalendarId)])

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  data: jsonb('data').notNull(),
  windowStart: date('window_start').notNull(),
  windowEnd: date('window_end').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
  integrationSnapshotAt: timestamp('integration_snapshot_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
})
