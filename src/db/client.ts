/**
 * Postgres pools for the app role. Refuses a migration superuser. Do not auto-send.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const APP_ROLES = new Set(["inbox_app", "mychef_runtime"]);
const KEY_ROLES = new Set(["inbox_key_reader", "mychef_runtime"]);

function assertUser(url: string, allowed: Set<string>) {
  const user = decodeURIComponent(new URL(url).username);
  if (!allowed.has(user)) {
    throw new Error(
      `Refusing database user "${user}". The request path must use an application role, not a migration superuser.`,
    );
  }
}

function pool(url: string, allowed: Set<string>) {
  assertUser(url, allowed);
  return new Pool({ connectionString: url, max: 8 });
}

const globalForDb = globalThis as unknown as {
  appPool?: Pool;
  keyPool?: Pool;
};

export const appPool =
  globalForDb.appPool ?? pool(required("DATABASE_URL"), APP_ROLES);
export const keyPool =
  globalForDb.keyPool ?? pool(required("KEY_READER_DATABASE_URL"), KEY_ROLES);

if (process.env.NODE_ENV !== "production") {
  globalForDb.appPool = appPool;
  globalForDb.keyPool = keyPool;
}

export const appDb = drizzle(appPool, { schema });
export const keyDb = drizzle(keyPool, { schema });
