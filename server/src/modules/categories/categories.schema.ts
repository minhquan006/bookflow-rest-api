import { z } from "zod";

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
