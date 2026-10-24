import type { Pool, PoolClient } from "pg";
import type { AppConfig } from "../../config/env.js";
import { withTransaction } from "../../db/pool.js";
import type { Principal } from "../../middleware/context.js";
import { AppError, forbidden, unauthenticated } from "../../shared/errors.js";
import { paginate } from "../../shared/pagination.js";
import type { LoanQuery } from "./loans.schema.js";
import * as repository from "./loans.repository.js";

const notFound = () =>
  new AppError(
    404,
    "RESOURCE_NOT_FOUND",
    "Not Found",
    "The requested loan or book does not exist.",
  );
const conflict = (code: string, detail: string) =>
  new AppError(409, code, "Conflict", detail);

async function loanTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withTransaction(pool, work);
    } catch (error) {
      const retryable =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        ["40001", "40P01"].includes(String(error.code));
      // These PostgreSQL errors guarantee that the whole transaction was rolled back.
      // Never retry connection failures or an ambiguous COMMIT outcome.
      if (!retryable || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 10));
    }
  }
}

export function createLoansService(
  pool: Pool,
  config: Pick<AppConfig, "maxActiveLoans" | "loanDurationDays">,
) {
  return {
    async borrow(actor: Principal, bookId: string, requestId: string) {
      if (actor.role !== "MEMBER") throw forbidden();
      try {
        return await loanTransaction(pool, async (client) => {
          // Serialize every borrowing request by one member before counting open loans.
          const borrower = await repository.lockBorrower(client, actor.id);
          if (!borrower || borrower.status !== "ACTIVE")
            throw unauthenticated();
          if (borrower.role !== "MEMBER") throw forbidden();
          const book = await repository.lockBorrowableBook(client, bookId);
          if (!book || book.archived_at) throw notFound();
          const state = await repository.activeBorrowing(
            client,
            actor.id,
            bookId,
          );
          if (state.has_overdue)
            throw conflict(
              "OVERDUE_LOANS",
              "Return overdue books before borrowing another copy.",
            );
          if (state.active_count >= config.maxActiveLoans)
            throw conflict(
              "LOAN_LIMIT_REACHED",
              `A member may hold at most ${config.maxActiveLoans} active loans.`,
            );
          if (state.duplicate_book)
            throw conflict(
              "ALREADY_BORROWED",
              "You already hold a copy of this book.",
            );
          const copy = await repository.lockAvailableCopy(client, bookId);
          if (!copy)
            throw conflict(
              "BOOK_UNAVAILABLE",
              "No copy is currently available for borrowing.",
            );
          const id = await repository.insertLoan(
            client,
            actor.id,
            copy.id,
            config.loanDurationDays,
          );
          await repository.insertLoanAudit(
            client,
            actor,
            "loan.created",
            id,
            requestId,
          );
          return (await repository.findLoan(client, id))!;
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505" &&
          "constraint" in error &&
          error.constraint === "loans_one_open_per_copy"
        ) {
          throw conflict(
            "BOOK_UNAVAILABLE",
            "No copy is currently available for borrowing.",
          );
        }
        throw error;
      }
    },
    async list(actor: Principal, input: LoanQuery) {
      const result = await repository.listLoanRows(pool, actor, input);
      return { data: result.data, pagination: paginate(input, result.total) };
    },
    async get(actor: Principal, id: string) {
      const loan = await repository.findLoan(pool, id, actor);
      if (!loan) throw notFound();
      return loan;
    },
    async returnLoan(actor: Principal, id: string, requestId: string) {
      if (!["LIBRARIAN", "ADMIN"].includes(actor.role)) throw forbidden();
      return loanTransaction(pool, async (client) => {
        const copyId = await repository.findCopyForLoan(client, id);
        if (!copyId) throw notFound();
        // Return never takes a user or book lock after taking its copy lock.
        const loan = await repository.lockReturnRows(client, id, copyId);
        if (!loan) throw notFound();
        if (loan.returned_at && loan.returned_by) {
          return repository.returnDto({
            id,
            returned_at: loan.returned_at,
            returned_by: loan.returned_by,
          });
        }
        const returned = await repository.markReturned(client, id, actor.id);
        await repository.insertLoanAudit(
          client,
          actor,
          "loan.returned",
          id,
          requestId,
        );
        return repository.returnDto(returned);
      });
    },
  };
}
