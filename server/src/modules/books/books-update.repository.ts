import type { PoolClient } from "pg";
import type { CreateBookInput } from "./books-write.schema.js";

const columns = {
  categoryId: "category_id",
  isbn: "isbn",
  title: "title",
  author: "author",
  description: "description",
} as const;

export async function updateBookMetadata(
  client: PoolClient,
  id: string,
  version: number,
  input: Partial<CreateBookInput>,
) {
  const assignments: string[] = [];
  const values: unknown[] = [id, version];

  for (const key of Object.keys(columns) as Array<keyof typeof columns>) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      values.push(input[key]);
      assignments.push(`${columns[key]} = $${values.length}`);
    }
  }

  const result = await client.query<{
    id: string;
    categoryId: string;
    isbn: string | null;
    title: string;
    author: string;
    description: string;
    archivedAt: Date | null;
    version: number;
  }>(
    `UPDATE books
     SET ${assignments.join(", ")},
         version = version + 1,
         updated_at = now()
     WHERE id = $1 AND version = $2
     RETURNING id, category_id AS "categoryId", isbn, title,
       author, description, archived_at AS "archivedAt", version`,
    values,
  );

  return result.rows[0] ?? null;
}

export async function bookExists(client: PoolClient, id: string) {
  const result = await client.query("SELECT id FROM books WHERE id = $1", [id]);
  return result.rowCount !== 0;
}

export async function lockMetadataCategory(
  client: PoolClient,
  categoryId: string,
) {
  const result = await client.query(
    "SELECT id FROM categories WHERE id = $1 FOR KEY SHARE",
    [categoryId],
  );
  return result.rowCount !== 0;
}

export async function insertMetadataAudit(
  client: PoolClient,
  actorId: string,
  bookId: string,
  requestId: string,
) {
  await client.query(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, request_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, "BOOK_METADATA_UPDATED", "book", bookId, requestId],
  );
}
