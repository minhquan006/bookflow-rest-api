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
