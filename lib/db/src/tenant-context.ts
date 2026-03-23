import { AsyncLocalStorage } from "async_hooks";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema";

export type TenantDb = NodePgDatabase<typeof schema>;

interface TenantStore {
  companyId: string;
  tenantDb: TenantDb;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function getTenantCompanyId(): string | undefined {
  return tenantStorage.getStore()?.companyId;
}

export function getTenantDb(): TenantDb | undefined {
  return tenantStorage.getStore()?.tenantDb;
}
