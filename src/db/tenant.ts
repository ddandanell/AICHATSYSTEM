import { sql } from "drizzle-orm";
import { appDb, keyDb } from "./client";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertOrgId(orgId: string): string {
  if (!UUID.test(orgId)) throw new Error("org id must be a uuid");
  return orgId;
}

export type AppTx = Parameters<Parameters<typeof appDb.transaction>[0]>[0];
export type KeyTx = Parameters<Parameters<typeof keyDb.transaction>[0]>[0];

async function setOrg(
  tx: { execute: AppTx["execute"] },
  orgId: string,
) {
  await tx.execute(sql`select set_config('app.current_org_id', ${orgId}, true)`);
}

export async function withTenant<T>(
  orgId: string,
  fn: (tx: AppTx) => Promise<T>,
): Promise<T> {
  const id = assertOrgId(orgId);
  return appDb.transaction(async (tx) => {
    await setOrg(tx, id);
    return fn(tx);
  });
}

export async function withKeyReader<T>(
  orgId: string,
  fn: (tx: KeyTx) => Promise<T>,
): Promise<T> {
  const id = assertOrgId(orgId);
  return keyDb.transaction(async (tx) => {
    await setOrg(tx, id);
    return fn(tx);
  });
}
