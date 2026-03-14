import {
  pgTable,
  text,
  timestamp,
  index,
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
    role: text("role", {
      enum: ["ADMIN", "OPERATOR", "VIEWER"],
    }).notNull(),
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
