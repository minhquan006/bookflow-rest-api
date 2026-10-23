import type { PoolClient } from "pg";
import type { CreateCategoryInput } from "./categories.schema.js";

export async function replaceCategory(
  client: PoolClient,
  id: string,
  input: CreateCategoryInput,
) {
  const result = await client.query<{
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
  }>(
    `UPDATE categories SET name = $2, slug = $3 WHERE id = $1
     RETURNING id, name, slug, created_at AS "createdAt"`,
    [id, input.name, input.slug],
  );
  return result.rows[0] ?? null;
}

export async function removeCategory(client: PoolClient, id: string) {
  const result = await client.query(
    "DELETE FROM categories WHERE id = $1 RETURNING id",
    [id],
  );
  return result.rowCount !== 0;
}

export async function insertCategoryMutationAudit(
  client: PoolClient,
  actorId: string,
  categoryId: string,
  action: "CATEGORY_UPDATED" | "CATEGORY_DELETED",
  requestId: string,
) {
  await client.query(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, request_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, action, "category", categoryId, requestId],
  );
}
