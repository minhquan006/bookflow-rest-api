import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export function paginate({ page, limit }: PaginationInput, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export function offsetOf({ page, limit }: PaginationInput) {
  return (page - 1) * limit;
}
