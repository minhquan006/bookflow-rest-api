import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const registerSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(120),
  email,
  password: z.string().min(12).max(128),
});
export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1).max(128),
});
export const emptyAuthBodySchema = z.strictObject({}).optional();
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
