import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function assertUser(url: string, expectedUser: string) {
  const user = new URL(url).username;
  if (user !== expectedUser) {
    throw new Error(
      `Refusing database user "${user}". Expected "${expectedUser}". The request path must not use the migration superuser.`,
    );
  }
}

function pool(url: string, expectedUser: string) {
  assertUser(url, expectedUser);
  return new Pool({ connectionString: url, max: 8 });
}

const globalForDb = globalThis as unknown as {
  appPool?: Pool;
  keyPool?: Pool;
};

export const appPool =
  globalForDb.appPool ?? pool(required("DATABASE_URL"), "inbox_app");
export const keyPool =
  globalForDb.keyPool ?? pool(required("KEY_READER_DATABASE_URL"), "inbox_key_reader");

if (process.env.NODE_ENV !== "production") {
  globalForDb.appPool = appPool;
  globalForDb.keyPool = keyPool;
}

export const appDb = drizzle(appPool, { schema });
export const keyDb = drizzle(keyPool, { schema });
