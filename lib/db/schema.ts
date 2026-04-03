import { integer, serial, text, timestamp, pgTable } from 'drizzle-orm/pg-core'

export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  authUserId: text('auth_user_id').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const projectsTable = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersTable.id),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const filesTable = pgTable('files', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id),
  path: text('path').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const messagesTable = pgTable('messages', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})
