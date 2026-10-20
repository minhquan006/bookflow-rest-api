import type { Pool } from "pg";
import type { Principal } from "../../middleware/context.js";
import { withTransaction } from "../../db/index.js";
import { AppError, forbidden } from "../../shared/errors.js";
import {
  lockCopy,
  hasOpenLoan,
  updateCopyCondition,
  insertCopyUpdateAudit,
  type CopyCondition,
} from "./copies-update.repository.js";

export async function changeCopyCondition(
  pool: Pool,
  actor: Principal,
  copyId: string,
  condition: CopyCondition,
  requestId: string,
) {
  if (actor.role !== "LIBRARIAN" && actor.role !== "ADMIN") {
    throw forbidden();
  }

  return withTransaction(pool, async (client) => {
    const copy = await lockCopy(client, copyId);
    if (!copy) {
      throw new AppError(
        404,
        "RESOURCE_NOT_FOUND",
        "Not Found",
        "The requested copy was not found.",
      );
    }

    if (copy.conditionStatus === condition) {
      return { ...copy, createdAt: copy.createdAt.toISOString() };
    }

    if (await hasOpenLoan(client, copyId)) {
      throw new AppError(
        409,
        "COPY_HAS_ACTIVE_LOAN",
        "Conflict",
        "Cannot change the condition of a copy with an active loan.",
      );
    }

    const updated = await updateCopyCondition(client, copyId, condition);
    await insertCopyUpdateAudit(client, actor.id, copyId, requestId);

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    };
  });
}
