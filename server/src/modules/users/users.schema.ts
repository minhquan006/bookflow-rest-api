import { z } from "zod";
import { paginationSchema } from "../../shared/pagination.js";

export const userListSchema = paginationSchema.strict();
export const userIdSchema = z.uuid();
export const userPatchSchema = z
  .strictObject({
    role: z.enum(["MEMBER", "LIBRARIAN", "ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "Provide role or status.");
export type UserPatch = z.infer<typeof userPatchSchema>;
