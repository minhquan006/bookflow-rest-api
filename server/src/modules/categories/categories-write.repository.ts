import type { PoolClient } from "pg";
import type { CreateCategoryInput } from "./categories.schema.js";

type CreatedCategory = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

export async function insertCategory(
  client: PoolClient,
  input: CreateCategoryInput,
) {
  const result = await client.query<CreatedCategory>(
    `INSERT INTO categories (name, slug)
     VALUES ($1, $2)
     RETURNING id, name, slug, created_at AS "createdAt"`,
    [input.name, input.slug],
  );

  return result.rows[0]!;
}

export async function insertCategoryAudit(
  client: PoolClient,
  actorId: string,
  categoryId: string,
  requestId: string,
) {
  await client.query(
    `INSERT INTO audit_logs
       (actor_id, action, entity_type, entity_id, request_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, "CATEGORY_CREATED", "category", categoryId, requestId],
  );
}
