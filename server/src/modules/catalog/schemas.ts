import { z } from "zod";
import { paginationSchema } from "../../shared/pagination.js";
export const idSchema = z.uuid();
export const categoryInput = z.strictObject({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
});
export const bookInput = z.strictObject({
  categoryId: idSchema,
  isbn: z
    .string()
    .regex(/^([0-9]{9}[0-9X]|[0-9]{13})$/)
    .nullable(),
  title: z.string().trim().min(1).max(255),
  author: z.string().trim().min(1).max(255),
  description: z.string().max(5000),
});
export const bookPatch = bookInput
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one field.",
  );
export const copyInput = z.strictObject({
  barcode: z.string().trim().min(1).max(64),
});
export const copyPatch = z.strictObject({
  conditionStatus: z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED"]),
});
export const pageQuery = paginationSchema
  .strict()
  .refine(
    (v) => Number.isSafeInteger((v.page - 1) * v.limit),
    "Pagination is out of range.",
  );
export const bookQuery = paginationSchema
  .extend({
    q: z.string().trim().max(200).default(""),
    categoryId: idSchema.optional(),
    sort: z
      .enum(["title", "-title", "createdAt", "-createdAt"])
      .default("title"),
    includeArchived: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  })
  .strict()
  .refine(
    (v) => Number.isSafeInteger((v.page - 1) * v.limit),
    "Pagination is out of range.",
  );
export type BookInput = z.infer<typeof bookInput>;
export type CategoryInput = z.infer<typeof categoryInput>;
export type BookQuery = z.infer<typeof bookQuery>;
export type Condition = z.infer<typeof copyPatch>["conditionStatus"];
