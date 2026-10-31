import type { Pool, PoolClient } from "pg";
import { appPool } from "@/db/client";

const WORKSPACE = "mychef";
const ROW_ID = "autopilot";
const MARK = "auto_sent_candidate";

type Db = Pool | PoolClient;

export type AutopilotSettings = {
  enabled: boolean;
  confidenceThreshold: number;
};

function thresholdOf(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) return 0.8;
  return Math.round(number * 100) / 100;
}

export async function readAutopilot(db: Db = appPool): Promise<AutopilotSettings> {
  const result = await db.query<{ enabled: boolean; config: { confidenceThreshold?: number } | null }>(
    `select enabled, config
     from mychef_inbox.integration_connections
     where workspace_id = $1 and id = $2`,
    [WORKSPACE, ROW_ID],
  );
  const row = result.rows[0];
  if (!row) return { enabled: false, confidenceThreshold: 0.8 };
  return {
    enabled: row.enabled === true,
    confidenceThreshold: thresholdOf(row.config?.confidenceThreshold),
  };
}

export async function saveAutopilot(input: AutopilotSettings) {
  const enabled = input.enabled === true;
  const confidenceThreshold = thresholdOf(input.confidenceThreshold);
  await appPool.query(
    `insert into mychef_inbox.integration_connections
       (workspace_id, id, kind, label, encrypted_secret, config, enabled, updated_at)
     values ($1, $2, 'ai', 'Autopilot', 'not-a-provider-key', $3::jsonb, $4, now())
     on conflict (workspace_id, id) do update
       set config = excluded.config,
           enabled = excluded.enabled,
           label = excluded.label,
           updated_at = now()
     where integration_connections.id = 'autopilot'`,
    [WORKSPACE, ROW_ID, JSON.stringify({ confidenceThreshold, autopilot: enabled }), enabled],
  );
  return { enabled, confidenceThreshold };
}

export async function recordAutoSendCandidateIfEnabled(
  db: Db,
  input: {
    conversationId: string;
    projectId: string;
    authorId: string;
    draftText: string;
    confidence: number;
    escalate: boolean;
    sourceRefs: unknown;
  },
): Promise<{ fired: boolean }> {
  const settings = await readAutopilot(db);
  if (!settings.enabled) return { fired: false };
  if (input.escalate || input.confidence < settings.confidenceThreshold) return { fired: false };
  const existing = await db.query(
    `select id from mychef_inbox.decision_records
     where workspace_id = $1 and conversation_id = $2
     limit 1`,
    [WORKSPACE, input.conversationId],
  );
  if ((existing.rowCount ?? 0) > 0) return { fired: false };
  const feedback = await db.query<{ id: string }>(
    `insert into mychef_inbox.feedback
       (workspace_id, conversation_id, scope, note, original_draft, edited_draft, author_id)
     values ($1, $2, 'conversation', $3, $4, $4, $5)
     returning id::text as id`,
    [
      WORKSPACE,
      input.conversationId,
      `Confidence ${input.confidence} met ${settings.confidenceThreshold}. Sending is not connected.`,
      input.draftText,
      input.authorId,
    ],
  );
  const feedbackId = feedback.rows[0]?.id;
  if (!feedbackId) return { fired: false };
  await db.query(
    `insert into mychef_inbox.decision_records
       (workspace_id, conversation_id, project_id, feedback_id, reason_code, rationale, why_not,
        rejected_alternative, human_decision, source_refs, author_id)
     values ($1, $2, $3, $4::uuid, $5, $6, $7, $5, 'rejected', $8::jsonb, $9)`,
    [
      WORKSPACE,
      input.conversationId,
      input.projectId || WORKSPACE,
      feedbackId,
      MARK,
      `Confidence ${input.confidence} met the threshold ${settings.confidenceThreshold}. Nothing was sent.`,
      "Sending is not connected.",
      JSON.stringify(input.sourceRefs ?? []),
      input.authorId,
    ],
  );
  await db.query(
    `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
     values ($1, $2, 'auto_sent_candidate', $3)`,
    [WORKSPACE, input.authorId, input.conversationId],
  );
  return { fired: true };
}
