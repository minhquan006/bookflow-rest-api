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
  createdAt: string;
  updatedAt: string;
};
export type Copy = {
  id: string;
  bookId: string;
  barcode: string;
  conditionStatus: "AVAILABLE" | "MAINTENANCE" | "RETIRED";
  createdAt: string;
};
export type Session = {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    fullName: string;
    role: "MEMBER" | "LIBRARIAN" | "ADMIN";
  };
};
export type Page<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
