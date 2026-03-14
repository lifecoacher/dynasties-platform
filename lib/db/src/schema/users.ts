import {
  pgTable,
  text,
  timestamp,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const usersTable = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", {
      enum: ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"],
    }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("users_company_id_idx").on(table.companyId),
    index("users_email_idx").on(table.email),
  ],
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
