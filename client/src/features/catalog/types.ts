export type Category = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};
export type Book = {
  id: string;
  categoryId: string;
  isbn: string | null;
  title: string;
  author: string;
  description: string;
  archivedAt: string | null;
  version: number;
};
export type BookInput = Pick<
  Book,
  "categoryId" | "isbn" | "title" | "author" | "description"
>;
export type Copy = {
  id: string;
  bookId: string;
  barcode: string;
  conditionStatus: "AVAILABLE" | "MAINTENANCE" | "RETIRED";
  createdAt: string;
};
export type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request could not be completed. Please try again.";
}
