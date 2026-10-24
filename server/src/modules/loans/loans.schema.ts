import { z } from "zod";
import { paginationSchema } from "../../shared/pagination.js";

export const loanInputSchema = z.strictObject({ bookId: z.uuid() });
export const loanIdSchema = z.strictObject({ id: z.uuid() });
export const returnInputSchema = z.strictObject({});
export const loanQuerySchema = paginationSchema
  .extend({
    status: z.enum(["ACTIVE", "RETURNED", "OVERDUE"]).optional(),
  })
  .strict()
  .refine(
    (query) => Number.isSafeInteger((query.page - 1) * query.limit),
    "Pagination offset is too large",
  );

export type LoanQuery = z.infer<typeof loanQuerySchema>;
export type Loan = {
  id: string;
  userId: string;
  bookId: string;
  copyId: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  returnedBy: string | null;
};
export type LoanReturn = {
  loanId: string;
  returnedAt: string;
  returnedBy: string;
};
