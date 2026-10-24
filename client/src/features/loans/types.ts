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

export type PageInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type LoanCollection = { data: Loan[]; pagination: PageInfo };

export function loanStatus(loan: Loan, at = Date.now()) {
  if (loan.returnedAt) return "Returned";
  return new Date(loan.dueAt).getTime() < at ? "Overdue" : "Active";
}

export function formatLibraryDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function shortId(value: string) {
  return value.slice(0, 8);
}
