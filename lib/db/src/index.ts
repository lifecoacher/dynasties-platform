import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const appDbUrl = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
export const appPool = new Pool({ connectionString: appDbUrl });

export const db = drizzle(pool, { schema });
export const appDb = drizzle(appPool, { schema });

export async function withTenantContext<T>(
  companyId: string,
  fn: (tenantDb: typeof appDb) => Promise<T>,
): Promise<T> {
  const client = await appPool.connect();
  try {
    const safeId = companyId.replace(/'/g, "''");
    await client.query(`SET app.current_company_id = '${safeId}'`);
    const tenantDb = drizzle(client as any, { schema });
    return await fn(tenantDb);
  } finally {
    await client.query(`RESET app.current_company_id`);
    client.release();
  }
}

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export * from "./schema";
