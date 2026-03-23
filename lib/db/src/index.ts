import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { tenantStorage, type TenantDb } from "./tenant-context";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const appDbUrl = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
export const appPool = new Pool({ connectionString: appDbUrl });

const superDb = drizzle(pool, { schema });
export const appDb = drizzle(appPool, { schema });

export const db: TenantDb = new Proxy(superDb, {
  get(target, prop, receiver) {
    const store = tenantStorage.getStore();
    if (store?.tenantDb) {
      return Reflect.get(store.tenantDb, prop, store.tenantDb);
    }
    return Reflect.get(target, prop, receiver);
  },
}) as TenantDb;

export async function withTenantContext<T>(
  companyId: string,
  fn: (tenantDb: TenantDb) => Promise<T>,
): Promise<T> {
  const client = await appPool.connect();
  try {
    const safeId = companyId.replace(/'/g, "''");
    await client.query(`SET app.current_company_id = '${safeId}'`);
    const tenantDb = drizzle(client as any, { schema });
    return await fn(tenantDb);
  } finally {
    try {
      await client.query(`RESET app.current_company_id`);
    } catch {}
    client.release();
  }
}

export async function runWithTenant<T>(
  companyId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const client = await appPool.connect();
  try {
    const safeId = companyId.replace(/'/g, "''");
    await client.query(`SET app.current_company_id = '${safeId}'`);
    const tenantDb = drizzle(client as any, { schema }) as TenantDb;
    return await tenantStorage.run({ companyId, tenantDb }, fn);
  } finally {
    try {
      await client.query(`RESET app.current_company_id`);
    } catch {}
    client.release();
  }
}

export { tenantStorage, getTenantCompanyId, getTenantDb } from "./tenant-context";

export type DbTransaction = Parameters<Parameters<typeof superDb.transaction>[0]>[0];

export * from "./schema";
