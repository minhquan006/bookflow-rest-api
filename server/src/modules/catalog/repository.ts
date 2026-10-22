import type { PoolClient } from "pg";
import type {
  BookInput,
  BookQuery,
  CategoryInput,
  Condition,
} from "./schemas.js";
import { offsetOf, type PaginationInput } from "../../shared/pagination.js";
export type Client = Pick<PoolClient, "query">;
export type Category = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};
export type Book = BookInput & {
  id: string;
  archivedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
export type Copy = {
  id: string;
  bookId: string;
  barcode: string;
  conditionStatus: Condition;
  createdAt: Date;
};
const categoryColumns = `id, name, slug, created_at AS "createdAt"`;
const bookColumns = `id, category_id AS "categoryId", isbn, title, author, description, archived_at AS "archivedAt", version, created_at AS "createdAt", updated_at AS "updatedAt"`;
const copyColumns = `id, book_id AS "bookId", barcode, condition_status AS "conditionStatus", created_at AS "createdAt"`;
export async function listCategories(client: Client, query: PaginationInput) {
  const count = await client.query<{ total: number }>(
    "SELECT count(*)::int AS total FROM categories",
  );
  const rows = await client.query<Category>(
    `SELECT ${categoryColumns} FROM categories ORDER BY name, id LIMIT $1 OFFSET $2`,
    [query.limit, offsetOf(query)],
  );
  return { data: rows.rows, total: count.rows[0]!.total };
}
export async function createCategory(client: Client, input: CategoryInput) {
  return (
    await client.query<Category>(
      `INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING ${categoryColumns}`,
      [input.name, input.slug],
    )
  ).rows[0]!;
}
export async function replaceCategory(
  client: Client,
  id: string,
  input: CategoryInput,
) {
  return (
    await client.query<Category>(
      `UPDATE categories SET name=$2, slug=$3 WHERE id=$1 RETURNING ${categoryColumns}`,
      [id, input.name, input.slug],
    )
  ).rows[0];
}
export async function deleteCategory(client: Client, id: string) {
  return (
    await client.query("DELETE FROM categories WHERE id=$1 RETURNING id", [id])
  ).rowCount;
}
export async function listBooks(client: Client, query: BookQuery) {
  const filter = `($1::boolean OR archived_at IS NULL) AND ($2::uuid IS NULL OR category_id=$2) AND ($3='' OR title ILIKE $4 OR author ILIKE $4 OR isbn ILIKE $4)`;
  const escaped = query.q.replace(/[\\%_]/g, "\\$&");
  const values = [
    query.includeArchived,
    query.categoryId ?? null,
    query.q,
    `%${escaped}%`,
  ];
  const total = (
    await client.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM books WHERE ${filter}`,
      values,
    )
  ).rows[0]!.total;
  const sorts = {
    title: "title ASC",
    "-title": "title DESC",
    createdAt: "created_at ASC",
    "-createdAt": "created_at DESC",
  };
  const data = (
    await client.query<Book>(
      `SELECT ${bookColumns} FROM books WHERE ${filter} ORDER BY ${sorts[query.sort]}, id ASC LIMIT $5 OFFSET $6`,
      [...values, query.limit, offsetOf(query)],
    )
  ).rows;
  return { data, total };
}
export async function findBook(client: Client, id: string, lock = false) {
  return (
    await client.query<Book>(
      `SELECT ${bookColumns} FROM books WHERE id=$1${lock ? " FOR UPDATE" : ""}`,
      [id],
    )
  ).rows[0];
}
export async function createBook(client: Client, input: BookInput) {
  return (
    await client.query<Book>(
      `INSERT INTO books (category_id, isbn, title, author, description) VALUES ($1,$2,$3,$4,$5) RETURNING ${bookColumns}`,
      [
        input.categoryId,
        input.isbn,
        input.title,
        input.author,
        input.description,
      ],
    )
  ).rows[0]!;
}
export async function replaceBook(
  client: Client,
  id: string,
  input: BookInput,
) {
  return (
    await client.query<Book>(
      `UPDATE books SET category_id=$2, isbn=$3, title=$4, author=$5, description=$6, version=version+1, updated_at=now() WHERE id=$1 RETURNING ${bookColumns}`,
      [
        id,
        input.categoryId,
        input.isbn,
        input.title,
        input.author,
        input.description,
      ],
    )
  ).rows[0]!;
}
export async function archiveBook(client: Client, id: string) {
  await client.query(
    "UPDATE books SET archived_at=now(), version=version+1, updated_at=now() WHERE id=$1",
    [id],
  );
}
export async function bookHasLoans(client: Client, id: string) {
  return (
    (
      await client.query(
        "SELECT 1 FROM loans l JOIN book_copies c ON c.id=l.copy_id WHERE c.book_id=$1 AND l.returned_at IS NULL LIMIT 1",
        [id],
      )
    ).rowCount! > 0
  );
}
export async function availability(client: Client, id: string) {
  const row = (
    await client.query<{ availableCopies: number }>(
      `SELECT
    (SELECT count(*)::int FROM book_copies c WHERE c.book_id=b.id AND c.condition_status='AVAILABLE'
     AND NOT EXISTS (SELECT 1 FROM loans WHERE copy_id=c.id AND returned_at IS NULL)) AS "availableCopies"
    FROM books b WHERE b.id=$1 AND b.archived_at IS NULL`,
      [id],
    )
  ).rows[0];
  return row?.availableCopies;
}
export async function listCopies(
  client: Client,
  id: string,
  query: PaginationInput,
) {
  const total = (
    await client.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM book_copies WHERE book_id=$1",
      [id],
    )
  ).rows[0]!.total;
  const data = (
    await client.query<Copy>(
      `SELECT ${copyColumns} FROM book_copies WHERE book_id=$1 ORDER BY barcode, id LIMIT $2 OFFSET $3`,
      [id, query.limit, offsetOf(query)],
    )
  ).rows;
  return { data, total };
}
export async function createCopy(client: Client, id: string, barcode: string) {
  return (
    await client.query<Copy>(
      `INSERT INTO book_copies (book_id, barcode) VALUES ($1,$2) RETURNING ${copyColumns}`,
      [id, barcode],
    )
  ).rows[0]!;
}
export async function findCopy(client: Client, id: string) {
  return (
    await client.query<Copy>(
      `SELECT ${copyColumns} FROM book_copies WHERE id=$1 FOR UPDATE`,
      [id],
    )
  ).rows[0];
}
export async function copyHasLoan(client: Client, id: string) {
  return (
    (
      await client.query(
        "SELECT 1 FROM loans WHERE copy_id=$1 AND returned_at IS NULL LIMIT 1",
        [id],
      )
    ).rowCount! > 0
  );
}
export async function updateCopy(
  client: Client,
  id: string,
  condition: Condition,
) {
  return (
    await client.query<Copy>(
      `UPDATE book_copies SET condition_status=$2 WHERE id=$1 RETURNING ${copyColumns}`,
      [id, condition],
    )
  ).rows[0]!;
}
export async function audit(
  client: Client,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  requestId: string,
) {
  await client.query(
    "INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, request_id) VALUES ($1,$2,$3,$4,$5)",
    [actorId, action, entityType, entityId, requestId],
  );
}
