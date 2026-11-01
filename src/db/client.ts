/**
 * Postgres pools for the app role. Refuses a migration superuser. Do not auto-send.
 * Pools are created on first use so `next build` can collect routes without opening Postgres.
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

function createPool(url: string, allowed: Set<string>) {
  assertUser(url, allowed);
  return new Pool({ connectionString: url, max: 8 });
}

const globalForDb = globalThis as unknown as {
  appPool?: Pool;
  keyPool?: Pool;
  appDb?: ReturnType<typeof drizzle<typeof schema>>;
  keyDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function getAppPool(): Pool {
  if (!globalForDb.appPool) {
    globalForDb.appPool = createPool(required("DATABASE_URL"), APP_ROLES);
  }
  return globalForDb.appPool;
}

function getKeyPool(): Pool {
  if (!globalForDb.keyPool) {
    globalForDb.keyPool = createPool(required("KEY_READER_DATABASE_URL"), KEY_ROLES);
  }
  return globalForDb.keyPool;
}

function getAppDb() {
  if (!globalForDb.appDb) {
    globalForDb.appDb = drizzle(getAppPool(), { schema });
  }
  return globalForDb.appDb;
}

function getKeyDb() {
  if (!globalForDb.keyDb) {
    globalForDb.keyDb = drizzle(getKeyPool(), { schema });
  }
  return globalForDb.keyDb;
}

function lazyPool(get: () => Pool): Pool {
  return new Proxy({} as Pool, {
    get(_target, prop, _receiver) {
      const real = get();
      const value = Reflect.get(real, prop, real);
      return typeof value === "function" ? value.bind(real) : value;
    },
  });
}

function lazyDb(get: () => ReturnType<typeof drizzle<typeof schema>>) {
  return new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
    get(_target, prop, _receiver) {
      const real = get();
      const value = Reflect.get(real as object, prop, real);
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
    },
  });
}

export const appPool = lazyPool(getAppPool);
export const keyPool = lazyPool(getKeyPool);
export const appDb = lazyDb(getAppDb);
export const keyDb = lazyDb(getKeyDb);
