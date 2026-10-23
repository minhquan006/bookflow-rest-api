import type { Pool } from "pg";
import { withTransaction } from "../../db/pool.js";
import { AppError, forbidden, unauthenticated } from "../../shared/errors.js";
import { paginate, type PaginationInput } from "../../shared/pagination.js";
import {
  findUser,
  insertAudit,
  toUser,
  listUsers,
  lockAdministration,
  lockUsers,
  countActiveAdmins,
  updateUser,
  revokeUserSessions,
} from "./users.repository.js";
import type { UserPatch } from "./users.schema.js";

export function createUsersService(pool: Pool) {
  return {
    async me(id: string) {
      const row = await findUser(pool, id);
      if (!row || row.status !== "ACTIVE") throw unauthenticated();
      return toUser(row);
    },
    async list(input: PaginationInput) {
      const result = await listUsers(pool, input);
      return {
        data: result.rows.map(toUser),
        pagination: paginate(input, result.total),
      };
    },
    async patch(
      actorId: string,
      id: string,
      patch: UserPatch,
      requestId: string,
    ) {
      return withTransaction(pool, async (client) => {
        // Serialize all role/status changes before row locks to protect the last-admin invariant.
        await lockAdministration(client);
        const locked = await lockUsers(client, [actorId, id]);
        const actor = locked.find((row) => row.id === actorId);
        if (!actor || actor.status !== "ACTIVE") throw unauthenticated();
        if (actor.role !== "ADMIN") throw forbidden();
        const target = locked.find((row) => row.id === id);
        if (!target)
          throw new AppError(
            404,
            "RESOURCE_NOT_FOUND",
            "Not Found",
            "The requested user does not exist.",
          );
        const nextRole = patch.role ?? target.role;
        const nextStatus = patch.status ?? target.status;
        if (
          target.role === "ADMIN" &&
          target.status === "ACTIVE" &&
          (nextRole !== "ADMIN" || nextStatus !== "ACTIVE")
        ) {
          if ((await countActiveAdmins(client)) <= 1)
            throw new AppError(
              409,
              "LAST_ACTIVE_ADMIN",
              "Conflict",
              "At least one active administrator must remain.",
            );
        }
        if (nextRole === target.role && nextStatus === target.status)
          return toUser(target);
        const updated = await updateUser(client, id, {
          role: nextRole,
          status: nextStatus,
        });
        await revokeUserSessions(client, id);
        await insertAudit(
          client,
          actorId,
          "user.updated",
          "user",
          id,
          requestId,
        );
        return toUser(updated);
      });
    },
  };
}
