import { eq, and, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export function tenantWhere(
  companyIdCol: PgColumn,
  companyId: string,
  ...conditions: (SQL | undefined)[]
): SQL {
  return and(
    eq(companyIdCol, companyId),
    ...conditions.filter(Boolean) as SQL[],
  )!;
}
