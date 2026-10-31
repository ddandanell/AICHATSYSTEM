/**
 * Seeds Harbor Kitchen and Northline on local Postgres. Do not auto-send.
 */
import pg from "pg";
import { ingestRetrieval } from "./ingest";
import {
  HARBOR_CONVO_ALLERGY,
  HARBOR_CONVO_DEPOSIT,
  HARBOR_DECISION_ALLERGY,
  HARBOR_DECISION_DEPOSIT,
  HARBOR_EVAL_ALLERGY,
  HARBOR_EVAL_DEPOSIT,
  HARBOR_MEMBERSHIP_ID,
  HARBOR_MSG_ALLERGY,
  HARBOR_MSG_DEPOSIT,
  HARBOR_ORG_ID,
  JONAH_USER_ID,
  MAYA_USER_ID,
  NORTHLINE_CONVO_LUNCH,
  NORTHLINE_DECISION_LUNCH,
  NORTHLINE_EVAL_LUNCH,
  NORTHLINE_FEEDBACK_LUNCH,
  NORTHLINE_MEMBERSHIP_ID,
  NORTHLINE_MSG_LUNCH,
  NORTHLINE_ORG_ID,
} from "./ids";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is not set");

async function main() {
const client = new pg.Client({ connectionString: url });
await client.connect();

const existing = await client.query(
  "select id from organizations where slug = 'harbor-kitchen'",
);
if (existing.rowCount) {
  console.log("seed already applied");
  await ingestRetrieval(client);
  await client.end();
  return;
}

const depositDraft =
  "Thanks for the note. The deposit is non-refundable inside 14 days of the event, and March 14 is inside that window. I can move the $800 to a new date once, if you book it within 6 months. I can't return it as cash.";
const allergyDraft =
  "We can cook that dinner nut-free. We'll need the allergy in writing 10 days before service, and we'll run a separate prep list so the plate doesn't share a pan with peanut garnish. I don't want them skipping the meal.";
const lunchDraft =
  "Our seated lunch starts at $48 per guest, so $35 won't cover a served meal with staff. Thursday this week is also inside our booking window.";
const lunchFinal =
  "Our seated lunch starts at $48 per guest, so $35 won't cover service and staff. We can do a drop-off buffet at $35 with disposables, or a seated lunch at $48. Thursday this week is inside 7 days, so I'd need a confirmed headcount today to hold it. 2nd Street is inside our delivery area.";

await client.query("begin");
try {
  await client.query(
    `insert into organizations (id, slug, name) values
      ($1, 'harbor-kitchen', 'Harbor Kitchen'),
      ($2, 'northline', 'Northline Catering')`,
    [HARBOR_ORG_ID, NORTHLINE_ORG_ID],
  );
  await client.query(
    `insert into users (id, email, name) values
      ($1, 'maya@harbor-kitchen.example', 'Maya Chen'),
      ($2, 'jonah@northline.example', 'Jonah Hale')`,
    [MAYA_USER_ID, JONAH_USER_ID],
  );
  await client.query(
    `insert into memberships (id, org_id, user_id, role) values
      ($1, $2, $3, 'owner'),
      ($4, $5, $6, 'owner')`,
    [
      HARBOR_MEMBERSHIP_ID,
      HARBOR_ORG_ID,
      MAYA_USER_ID,
      NORTHLINE_MEMBERSHIP_ID,
      NORTHLINE_ORG_ID,
      JONAH_USER_ID,
    ],
  );

  await client.query(
    `insert into raw_messages (id, org_id, conversation_id, body, channel, received_at) values
      ($1, $2, $3, $4, 'manual', now() - interval '3 hours'),
      ($5, $2, $6, $7, 'manual', now() - interval '2 hours'),
      ($8, $9, $10, $11, 'manual', now() - interval '1 day')`,
    [
      HARBOR_MSG_DEPOSIT,
      HARBOR_ORG_ID,
      HARBOR_CONVO_DEPOSIT,
      "Hi — we booked the March 14 dinner for 18. Two families just cancelled and I need the $800 deposit back. The dinner is nine days away. Can you refund it this week?",
      HARBOR_MSG_ALLERGY,
      HARBOR_CONVO_ALLERGY,
      "Quick question for the May 2 plated dinner. One guest has a severe peanut allergy, not just a preference. Do you cook nut-free, or should we tell them to eat beforehand?",
      NORTHLINE_MSG_LUNCH,
      NORTHLINE_ORG_ID,
      NORTHLINE_CONVO_LUNCH,
      "Can you do a seated lunch for 40 people this Thursday at $35 a head? We need it in our office on 2nd Street.",
    ],
  );

  await client.query(
    `insert into decision_records (
      id, org_id, conversation_id, inbound_message_id, draft_text, confidence, source_refs, status, created_at
    ) values
      ($1, $2, $3, $4, $5, 0.78, $6::jsonb, 'pending_review', now() - interval '3 hours'),
      ($7, $2, $8, $9, $10, 0.64, $11::jsonb, 'pending_review', now() - interval '2 hours')`,
    [
      HARBOR_DECISION_DEPOSIT,
      HARBOR_ORG_ID,
      HARBOR_CONVO_DEPOSIT,
      HARBOR_MSG_DEPOSIT,
      depositDraft,
      JSON.stringify([
        {
          id: "deposit-cancellation",
          title: "Deposits and cancellations",
          kind: "position",
        },
      ]),
      HARBOR_DECISION_ALLERGY,
      HARBOR_CONVO_ALLERGY,
      HARBOR_MSG_ALLERGY,
      allergyDraft,
      JSON.stringify([
        {
          id: "allergy-disclosure",
          title: "Allergy disclosure",
          kind: "position",
        },
      ]),
    ],
  );

  await client.query(
    `insert into decision_records (
      id, org_id, conversation_id, inbound_message_id, draft_text, final_text,
      action_taken, rationale, why_not, rejected_alternative, reason_code,
      confidence, source_refs, human_decision, status, created_at
    ) values (
      $1, $2, $3, $4, $5, $6,
      'edited', $7, $8, $5, 'missed_upsell',
      0.71, $9::jsonb, 'edited', 'reviewed', now() - interval '1 day'
    )`,
    [
      NORTHLINE_DECISION_LUNCH,
      NORTHLINE_ORG_ID,
      NORTHLINE_CONVO_LUNCH,
      NORTHLINE_MSG_LUNCH,
      lunchDraft,
      lunchFinal,
      "The seated minimum is right, but they can still buy the drop-off. The draft stopped at no.",
      "A flat refusal would have lost a menu that already fits $35.",
      JSON.stringify([
        {
          id: "guest-minimums",
          title: "Guest count minimums",
          kind: "position",
        },
      ]),
    ],
  );

  await client.query(
    `insert into feedback_events (
      id, org_id, decision_record_id, actor_id, human_decision, reason_code,
      rationale, why_not, source_marks
    ) values ($1, $2, $3, $4, 'edited', 'missed_upsell', $5, $6, $7::jsonb)`,
    [
      NORTHLINE_FEEDBACK_LUNCH,
      NORTHLINE_ORG_ID,
      NORTHLINE_DECISION_LUNCH,
      JONAH_USER_ID,
      "The seated minimum is right, but they can still buy the drop-off. The draft stopped at no.",
      "A flat refusal would have lost a menu that already fits $35.",
      JSON.stringify([
        { id: "guest-minimums", mark: "cited" },
        { id: "service-area", mark: "missing" },
      ]),
    ],
  );

  await client.query(
    `insert into eval_cases (
      id, org_id, name, inbound_text, expected_decision, expected_reason_code, must_include, must_not_include
    ) values
      ($1, $2, 'Deposit inside the window', $3, 'rejected', 'wrong_policy', 'non-refundable', 'full refund'),
      ($4, $2, 'Nut allergy plated dinner', $5, 'edited', 'should_have_asked', 'allergy', 'we cannot accommodate'),
      ($6, $7, 'Below minimum lunch', $8, 'edited', 'missed_upsell', '$48', 'we can do $35 seated')`,
    [
      HARBOR_EVAL_DEPOSIT,
      HARBOR_ORG_ID,
      "Can I get the deposit back? The dinner is in five days.",
      HARBOR_EVAL_ALLERGY,
      "One guest has a severe peanut allergy. Can you still plate a full dinner?",
      NORTHLINE_EVAL_LUNCH,
      NORTHLINE_ORG_ID,
      "40 guests at $35 a head, seated, this Thursday.",
    ],
  );

  await client.query("commit");
  console.log("seeded harbor-kitchen and northline");
} catch (error) {
  await client.query("rollback");
  throw error;
}

await ingestRetrieval(client);
await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
