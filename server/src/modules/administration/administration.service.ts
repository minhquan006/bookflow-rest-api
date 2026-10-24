import type { Pool } from "pg";
import { paginate } from "../../shared/pagination.js";
import type { AuditQuery } from "./administration.schema.js";
import { readAuditLogs, readDashboard } from "./administration.repository.js";

export function createAdministrationService(pool: Pool) {
  return {
    dashboard: () => readDashboard(pool),
    async auditLogs(input: AuditQuery) {
      const result = await readAuditLogs(pool, input);
      return { data: result.data, pagination: paginate(input, result.total) };
    },
  };
}
