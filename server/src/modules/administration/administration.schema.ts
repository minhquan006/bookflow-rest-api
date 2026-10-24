import { z } from "zod";
import { paginationSchema } from "../../shared/pagination.js";

export const auditQuerySchema = paginationSchema
  .extend({
    action: z.string().min(1).max(100).optional(),
    actorId: z.uuid().optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(
    (value) => Number.isSafeInteger((value.page - 1) * value.limit),
    "Pagination offset is too large",
  )
  .refine(
    (value) =>
      !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to),
    "from must be earlier than to",
  );
export type AuditQuery = z.infer<typeof auditQuerySchema>;
