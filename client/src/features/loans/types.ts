import type { PaginatedCollection } from "../../lib/pagination";

export type Loan = {
  id: string;
  userId: string;
  bookId: string;
  copyId: string;
  book: { id: string; title: string };
  copy: { id: string; barcode: string };
  borrower?: { id: string; fullName: string };
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

export type LoanCollection = PaginatedCollection<Loan>;

export function loanStatus(loan: Loan, at = Date.now()) {
  if (loan.returnedAt) return "Returned";
  return new Date(loan.dueAt).getTime() < at ? "Overdue" : "Active";
}

export function shortId(value: string) {
  return value.slice(0, 8);
}
