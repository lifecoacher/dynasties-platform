import { z } from "zod/v4";

export const UserSchema = z.object({
  id: z.string().ulid(),
  companyId: z.string().ulid(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateUser = z.infer<typeof CreateUserSchema>;
