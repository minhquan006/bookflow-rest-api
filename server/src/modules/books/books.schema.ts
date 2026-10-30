import { z } from "zod";
import { paginationSchema } from "../../shared/pagination.js";

export const listBooksSchema = paginationSchema
  .extend({
    q: z.string().trim().max(200).optional(),
    categoryId: z.uuid().optional(),
    sort: z
      .enum(["title", "-title", "createdAt", "-createdAt"])
      .default("title"),
    includeArchived: z.enum(["true", "false"]).default("false"),
  })
  .strict();

export type ListBooksInput = z.infer<typeof listBooksSchema>;

export const createBookSchema = z
  .object({
    categoryId: z.uuid(),
    isbn: z
      .string()
      .regex(/^(?:[0-9]{9}[0-9X]|[0-9]{13})$/)
      .nullable(),
    title: z.string().trim().min(1).max(255),
    author: z.string().trim().min(1).max(255),
    description: z.string().max(5000),
  })
  .strict();

export type CreateBookInput = z.infer<typeof createBookSchema>;
