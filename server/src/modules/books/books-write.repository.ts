import type { PoolClient } from "pg";
import type { CreateBookInput } from "./books-write.schema.js";

type CreatedBook = {
  id: string;
  categoryId: string;
  isbn: string | null;
  title: string;
  author: string;
  description: string;
  archivedAt: Date | null;
  version: number;
};

export async function insertBook(client: PoolClient, input: CreateBookInput) {
  const result = await client.query<CreatedBook>(
    `INSERT INTO books (category_id, isbn, title, author, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       id,
       category_id AS "categoryId",
       isbn,
       title,
       author,
       description,
       archived_at AS "archivedAt",
       version`,
    [
      input.categoryId,
      input.isbn,
      input.title,
      input.author,
      input.description,
    ],
  );
  return result.rows[0]!;
}

export async function insertBookAudit(
  client: PoolClient,
  actorId: string,
  bookId: string,
  requestId: string,
) {
  await client.query(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, request_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, "BOOK_CREATED", "book", bookId, requestId],
  );
}
