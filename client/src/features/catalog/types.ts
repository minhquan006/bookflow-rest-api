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
