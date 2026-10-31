import { eq, sql } from "drizzle-orm";
import pg from "pg";
import { appDb, appPool, keyPool } from "../src/db/client";
import {
  HARBOR_DECISION_ALLERGY,
  HARBOR_DECISION_DEPOSIT,
  HARBOR_ORG_ID,
  JONAH_USER_ID,
  MAYA_USER_ID,
  NORTHLINE_DECISION_LUNCH,
  NORTHLINE_ORG_ID,
} from "../src/db/ids";
import { decisionRecords } from "../src/db/schema";
import { withTenant } from "../src/db/tenant";
import { encryptSecret, decryptSecret, keyHint } from "../src/lib/crypto";
import { getDecision, saveReview } from "../src/lib/decisions";
import { testProviderConnection } from "../src/lib/gateway";
import { authorizeWorkspace } from "../src/lib/workspace-access";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function errorText(error: unknown): string {
  const parts: string[] = [];
  const queue = [error];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (current == null || seen.has(current)) continue;
    seen.add(current);
    parts.push(current instanceof Error ? `${current.name}: ${current.message}` : String(current));
    if (typeof current === "object" && "cause" in current) {
      queue.push(current.cause);
    }
  }
  return parts.join("\n");
}

async function main() {
const roundtrip = "sk-test-harbor-key-9f3a";
const encrypted = encryptSecret(roundtrip);
assert(decryptSecret(encrypted) === roundtrip, "AES-GCM roundtrip failed");
assert(keyHint(roundtrip) === "9f3a", "hint must be the last 4 characters");
assert(!encrypted.toString("utf8").includes(roundtrip), "ciphertext must not contain the raw key");

const mayaHarbor = await authorizeWorkspace(MAYA_USER_ID, "harbor-kitchen");
assert(mayaHarbor.status === "ok", "Maya should belong to Harbor Kitchen");
const mayaNorthline = await authorizeWorkspace(MAYA_USER_ID, "northline");
assert(mayaNorthline.status === "forbidden", "Maya's session must not enter Northline");

const jonahNorthline = await authorizeWorkspace(JONAH_USER_ID, "northline");
assert(jonahNorthline.status === "ok", "Jonah should belong to Northline");
const jonahHarbor = await authorizeWorkspace(JONAH_USER_ID, "harbor-kitchen");
assert(jonahHarbor.status === "forbidden", "Jonah's session must not enter Harbor");

const harborRows = await withTenant(HARBOR_ORG_ID, async (tx) => {
  return tx
    .select({ id: decisionRecords.id, orgId: decisionRecords.orgId })
    .from(decisionRecords);
});
assert(harborRows.length === 2, `Harbor session should see 2 decisions, saw ${harborRows.length}`);
assert(
  harborRows.every((row) => row.orgId === HARBOR_ORG_ID),
  "Harbor session saw another tenant's org id",
);
assert(
  !harborRows.some((row) => row.id === NORTHLINE_DECISION_LUNCH),
  "Harbor session listed Northline's decision",
);

const harborLeak = await withTenant(HARBOR_ORG_ID, async (tx) => {
  return tx
    .select({ id: decisionRecords.id })
    .from(decisionRecords)
    .where(eq(decisionRecords.id, NORTHLINE_DECISION_LUNCH));
});
assert(harborLeak.length === 0, "Harbor session read Northline's decision by id");

const northlineRows = await withTenant(NORTHLINE_ORG_ID, async (tx) => {
  return tx
    .select({ id: decisionRecords.id, orgId: decisionRecords.orgId })
    .from(decisionRecords);
});
assert(
  northlineRows.length === 1 && northlineRows[0]?.id === NORTHLINE_DECISION_LUNCH,
  "Northline session should see only its reviewed decision",
);
const northlineLeak = await withTenant(NORTHLINE_ORG_ID, async (tx) => {
  return tx
    .select({ id: decisionRecords.id })
    .from(decisionRecords)
    .where(eq(decisionRecords.id, HARBOR_DECISION_DEPOSIT));
});
assert(northlineLeak.length === 0, "Northline session read a Harbor decision by id");
const allergyLeak = await withTenant(NORTHLINE_ORG_ID, async (tx) => {
  return tx
    .select({ id: decisionRecords.id })
    .from(decisionRecords)
    .where(eq(decisionRecords.id, HARBOR_DECISION_ALLERGY));
});
assert(allergyLeak.length === 0, "Northline session read Harbor's second decision");

const bare = await appDb.select({ id: decisionRecords.id }).from(decisionRecords);
assert(bare.length === 0, `decision rows were visible with no org context (${bare.length})`);

let columnDenied = false;
try {
  await withTenant(HARBOR_ORG_ID, async (tx) => {
    await tx.execute(sql`select encrypted_key from provider_credentials`);
  });
} catch (error) {
  columnDenied = /permission denied/i.test(errorText(error));
}
assert(columnDenied, "inbox_app should not be able to select encrypted_key");

let updateDenied = false;
try {
  await withTenant(HARBOR_ORG_ID, async (tx) => {
    await tx.execute(sql`update raw_messages set body = body`);
  });
} catch (error) {
  updateDenied = /permission denied/i.test(errorText(error));
}
assert(updateDenied, "inbox_app should not be able to update raw_messages");

const noKey = await testProviderConnection(HARBOR_ORG_ID, "openai");
assert(
  noKey.ok === false && noKey.error === "No active key stored for this provider.",
  `expected a no-key result, got ${JSON.stringify(noKey)}`,
);

const saved = await saveReview(
  HARBOR_ORG_ID,
  MAYA_USER_ID,
  HARBOR_DECISION_DEPOSIT,
  {
    humanDecision: "rejected",
    reasonCode: "wrong_policy",
    rationale: "A cash refund would contradict the deposit position.",
    whyNot: "The guest asked for cash, and the position only allows a date move.",
    finalText: "",
    sourceMarks: [{ id: "deposit-cancellation", mark: "cited" }],
  },
);
assert(saved.ok, `review did not save: ${JSON.stringify(saved)}`);
const reviewed = await getDecision(HARBOR_ORG_ID, HARBOR_DECISION_DEPOSIT);
assert(reviewed?.status === "reviewed", "Harbor should see the reviewed decision");
assert(reviewed?.feedback.length === 1, "saving a review must write a feedback event");
assert(
  reviewed?.inboundBody.startsWith("Hi —"),
  "raw inbound text must stay immutable",
);
assert(
  (await getDecision(NORTHLINE_ORG_ID, HARBOR_DECISION_DEPOSIT)) === null,
  "Northline read Harbor's decision after review",
);

const adminUrl = process.env.MIGRATION_DATABASE_URL;
if (!adminUrl) throw new Error("MIGRATION_DATABASE_URL is not set");
const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
const counts = await admin.query<{ org_id: string; count: string }>(
  "select org_id, count(*)::text as count from decision_records group by org_id",
);
const byOrg = new Map(counts.rows.map((row) => [row.org_id, Number(row.count)]));
assert(byOrg.get(HARBOR_ORG_ID) === 2, "superuser should see Harbor's two decisions");
assert(byOrg.get(NORTHLINE_ORG_ID) === 1, "superuser should see Northline's decision");
await admin.query("delete from feedback_events where decision_record_id = $1", [
  HARBOR_DECISION_DEPOSIT,
]);
await admin.query(
  `update decision_records
     set status = 'pending_review',
         human_decision = null,
         reason_code = null,
         rationale = null,
         why_not = null,
         final_text = null,
         action_taken = null,
         rejected_alternative = null
   where id = $1`,
  [HARBOR_DECISION_DEPOSIT],
);
await admin.end();

console.log(
  JSON.stringify(
    {
      pass: true,
      harborVisible: harborRows.map((row) => row.id),
      northlineVisible: northlineRows.map((row) => row.id),
      crossReadById: 0,
      noOrgContext: bare.length,
      mayaNorthline: mayaNorthline.status,
      jonahHarbor: jonahHarbor.status,
      ciphertextSelectableByAppRole: false,
    },
    null,
    2,
  ),
);
await appPool.end();
await keyPool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
