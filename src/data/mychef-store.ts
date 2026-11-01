/**
 * Neon mychef_inbox store.
 *
 * Learning Queue (CBLS): clusters decision_records + feedback into pending
 * learning-pass / ledger-rule proposals. Approve writes situational knowledge.
 * Idempotency: audit_log action learn:processed per decision id (no DDL).
 * Never auto-activates proposals and never sends.
 * Docs: cbls-architecture.md / handoff.md / learning-queue.md in the project agent store.
 */
import { appPool } from "@/db/client";
import { decryptSecret, encryptSecret, keyHint } from "@/lib/crypto";
import { localStructuredDraft } from "@/lib/draft";
import { tokenize } from "@/lib/embed";
import { groupForTitle, type KnowledgeGroup } from "@/lib/knowledge-groups";
import {
  buildProposalContent,
  isKnowledgeGapReason,
  isLearnableReason,
  learningSnippet,
  parseProposalMeta,
  queueTypeForReason,
  type EvidenceDiff,
  type QueueType,
} from "@/lib/learning-queue";
import type { Provider } from "@/lib/providers";
import { PROVIDERS } from "@/lib/providers";
import type { HumanDecision, Outcome } from "@/lib/reason-codes";
import type { Pool, PoolClient } from "pg";

export const MYCHEF_WORKSPACE = "mychef";

/** Exclude proposal / rule sources from the curated library count (the 12). */
const LIBRARY_SOURCES_SQL = `source not in ('ledger-rule', 'learning-pass', 'situational')`;

type Db = Pool | PoolClient;
type QueryResult<T> = T[];

async function query<T>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const result = await appPool.query(text, params);
  return result.rows as T[];
}

async function rows<T>(db: Db, text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const result = await db.query(text, params);
  return result.rows as T[];
}

function kindForTitle(title: string): "position" | "playbook" {
  return /TEMPLATE|TONE|QUICK_START|SYSTEM_PROMPT|README/i.test(title) ? "playbook" : "position";
}

function lexical(queryText: string, title: string, body: string): number {
  const tokens = new Set(tokenize(queryText));
  if (tokens.size === 0) return 0;
  let hits = 0;
  const seen = new Set<string>();
  for (const token of tokenize(`${title}\n${body}`)) {
    if (seen.has(token) || !tokens.has(token)) continue;
    seen.add(token);
    hits += token.length > 4 && title.toLowerCase().includes(token) ? 3 : 1;
  }
  return hits / tokens.size;
}

export async function dashboardCounts() {
  const rows = await query<{
    contacts: string;
    messages: string;
    knowledge: string;
    needs_reply: string;
    decisions: string;
    candidates: string;
  }>(
    `select
       (select count(*) from mychef_inbox.contacts where workspace_id = $1) as contacts,
       (select count(*) from mychef_inbox.messages where workspace_id = $1) as messages,
       (select count(*) from mychef_inbox.knowledge where workspace_id = $1 and ${LIBRARY_SOURCES_SQL}) as knowledge,
       (select count(*) from mychef_inbox.conversations c
         where c.workspace_id = $1 and c.status = 'needs_reply'
           and not exists (
             select 1 from mychef_inbox.decision_records d
             where d.workspace_id = c.workspace_id and d.conversation_id = c.id
           )) as needs_reply,
       (select count(*) from mychef_inbox.decision_records where workspace_id = $1) as decisions,
       (select count(*) from mychef_inbox.knowledge where workspace_id = $1 and source in ('ledger-rule', 'learning-pass') and status = 'pending') as candidates`,
    [MYCHEF_WORKSPACE],
  );
  const row = rows[0];
  return {
    contacts: Number(row?.contacts ?? 0),
    messages: Number(row?.messages ?? 0),
    knowledge: Number(row?.knowledge ?? 0),
    needsReply: Number(row?.needs_reply ?? 0),
    decisions: Number(row?.decisions ?? 0),
    candidates: Number(row?.candidates ?? 0),
  };
}

const PAGE_SIZE = 25;

function pageOffset(page: number) {
  const safe = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  return { page: safe, offset: (safe - 1) * PAGE_SIZE };
}

export async function listInbox(
  status: "pending_review" | "reviewed",
  page = 1,
  search = "",
) {
  const requested = pageOffset(page);
  const needle = search.trim().replace(/[%_]/g, "");
  if (status === "reviewed") {
    const totalRows = await query<{ n: string }>(
      `select count(*)::text as n
       from mychef_inbox.decision_records d
       left join mychef_inbox.conversations c
         on c.workspace_id = d.workspace_id and c.id = d.conversation_id
       left join mychef_inbox.contacts ct
         on ct.workspace_id = c.workspace_id and ct.id = c.contact_id
       where d.workspace_id = $1
         and ($2::text = '' or ct.name ilike '%' || $2 || '%')`,
      [MYCHEF_WORKSPACE, needle],
    );
    const total = Number(totalRows[0]?.n ?? 0);
    const safePage = Math.min(requested.page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
    const offset = (safePage - 1) * PAGE_SIZE;
    const rows = await query<{
      id: string;
      name: string | null;
      inbound: string | null;
      draft: string | null;
      human_decision: string;
      reason_code: string;
      created_at: Date;
    }>(
      `select d.id::text as id,
              ct.name,
              left(m.body, 180) as inbound,
              left(f.original_draft, 180) as draft,
              d.human_decision,
              d.reason_code,
              d.created_at
       from mychef_inbox.decision_records d
       join mychef_inbox.feedback f on f.id = d.feedback_id
       left join mychef_inbox.conversations c
         on c.workspace_id = d.workspace_id and c.id = d.conversation_id
       left join mychef_inbox.contacts ct
         on ct.workspace_id = c.workspace_id and ct.id = c.contact_id
       left join lateral (
         select body from mychef_inbox.messages
         where workspace_id = d.workspace_id
           and conversation_id = d.conversation_id
           and direction = 'inbound'
         order by created_at desc
         limit 1
       ) m on true
       where d.workspace_id = $1
         and ($2::text = '' or ct.name ilike '%' || $2 || '%')
       order by d.created_at desc
       limit $3 offset $4`,
      [MYCHEF_WORKSPACE, needle, PAGE_SIZE, offset],
    );
    return { rows, total, page: safePage, pageSize: PAGE_SIZE };
  }
  const totalRows = await query<{ n: string }>(
    `select count(*)::text as n
     from mychef_inbox.conversations c
     join mychef_inbox.contacts ct
       on ct.workspace_id = c.workspace_id and ct.id = c.contact_id
     where c.workspace_id = $1
       and c.status = 'needs_reply'
       and ($2::text = '' or ct.name ilike '%' || $2 || '%')
       and not exists (
         select 1 from mychef_inbox.decision_records d
         where d.workspace_id = c.workspace_id and d.conversation_id = c.id
       )`,
    [MYCHEF_WORKSPACE, needle],
  );
  const total = Number(totalRows[0]?.n ?? 0);
  const safePage = Math.min(requested.page, Math.max(1, Math.ceil(total / PAGE_SIZE) || 1));
  const offset = (safePage - 1) * PAGE_SIZE;
  const rows = await query<{
    id: string;
    name: string | null;
    inbound: string | null;
    draft: string | null;
    last_message_at: Date | null;
  }>(
    `select c.id,
            ct.name,
            left(m.body, 180) as inbound,
            left(dr.body, 180) as draft,
            c.last_message_at
     from mychef_inbox.conversations c
     join mychef_inbox.contacts ct
       on ct.workspace_id = c.workspace_id and ct.id = c.contact_id
     left join lateral (
       select body from mychef_inbox.messages
       where workspace_id = c.workspace_id and conversation_id = c.id and direction = 'inbound'
       order by created_at desc limit 1
     ) m on true
     left join lateral (
       select body from mychef_inbox.drafts
       where workspace_id = c.workspace_id and conversation_id = c.id
       order by created_at desc limit 1
     ) dr on true
     where c.workspace_id = $1
       and c.status = 'needs_reply'
       and ($2::text = '' or ct.name ilike '%' || $2 || '%')
       and not exists (
         select 1 from mychef_inbox.decision_records d
         where d.workspace_id = c.workspace_id and d.conversation_id = c.id
       )
     order by c.last_message_at desc nulls last
     limit $3 offset $4`,
    [MYCHEF_WORKSPACE, needle, PAGE_SIZE, offset],
  );
  return { rows, total, page: safePage, pageSize: PAGE_SIZE };
}

export async function getConversation(id: string) {
  const conversations = await query<{
    id: string;
    contact_name: string | null;
    project_id: string | null;
    status: string;
  }>(
    `select c.id, ct.name as contact_name, c.project_id, c.status
     from mychef_inbox.conversations c
     left join mychef_inbox.contacts ct
       on ct.workspace_id = c.workspace_id and ct.id = c.contact_id
     where c.workspace_id = $1 and c.id = $2`,
    [MYCHEF_WORKSPACE, id],
  );
  const conversation = conversations[0];
  if (!conversation) return null;
  const messages = await query<{
    id: string;
    direction: string;
    body: string;
    created_at: Date;
  }>(
    `select id, direction, body, created_at
     from mychef_inbox.messages
     where workspace_id = $1 and conversation_id = $2
     order by created_at desc
     limit 40`,
    [MYCHEF_WORKSPACE, id],
  );
  const drafts = await query<{
    id: string;
    body: string;
    model: string | null;
    created_at: Date;
    source_ids: unknown;
  }>(
    `select id::text as id, body, model, created_at, source_ids
     from mychef_inbox.drafts
     where workspace_id = $1 and conversation_id = $2
     order by created_at desc
     limit 1`,
    [MYCHEF_WORKSPACE, id],
  );
  const decisions = await query<{ id: string }>(
    `select id::text as id from mychef_inbox.decision_records
     where workspace_id = $1 and conversation_id = $2
     limit 1`,
    [MYCHEF_WORKSPACE, id],
  );
  return {
    ...conversation,
    messages: messages.reverse(),
    draft: drafts[0] ?? null,
    decided: Boolean(decisions[0]),
  };
}

export async function getRecordedDecision(id: string) {
  const rows = await query<{
    id: string;
    conversation_id: string;
    human_decision: string;
    reason_code: string;
    rationale: string;
    why_not: string;
    rejected_alternative: string;
    created_at: Date;
    original_draft: string;
    edited_draft: string;
    inbound: string | null;
    contact_name: string | null;
  }>(
    `select d.id::text as id, d.conversation_id, d.human_decision, d.reason_code,
            d.rationale, d.why_not, d.rejected_alternative, d.created_at,
            f.original_draft, f.edited_draft,
            m.body as inbound,
            ct.name as contact_name
     from mychef_inbox.decision_records d
     join mychef_inbox.feedback f on f.id = d.feedback_id
     left join mychef_inbox.conversations c
       on c.workspace_id = d.workspace_id and c.id = d.conversation_id
     left join mychef_inbox.contacts ct
       on ct.workspace_id = c.workspace_id and ct.id = c.contact_id
     left join lateral (
       select body from mychef_inbox.messages
       where workspace_id = d.workspace_id and conversation_id = d.conversation_id
         and direction = 'inbound'
       order by created_at desc limit 1
     ) m on true
     where d.workspace_id = $1 and d.id = $2::uuid`,
    [MYCHEF_WORKSPACE, id],
  );
  const decision = rows[0];
  if (!decision) return null;
  const outcome = await query<{ action: string }>(
    `select action from mychef_inbox.audit_log
     where workspace_id = $1 and record_id = $2 and action like 'outcome:%'
     order by created_at desc limit 1`,
    [MYCHEF_WORKSPACE, id],
  );
  return {
    ...decision,
    outcome: outcome[0]?.action?.slice("outcome:".length) ?? null,
  };
}

async function rankKnowledge(inbound: string) {
  const docs = await query<{ id: string; title: string; content: string }>(
    `select id, title, content
     from mychef_inbox.knowledge
     where workspace_id = $1
       and (
         ${LIBRARY_SOURCES_SQL}
         or (source = 'situational' and status = 'approved')
       )`,
    [MYCHEF_WORKSPACE],
  );
  return docs
    .map((doc) => ({
      doc,
      score: lexical(inbound, doc.title, doc.content),
      kind: kindForTitle(doc.title),
    }))
    .sort((left, right) => right.score - left.score);
}

export async function draftForConversation(conversationId: string, authorId: string) {
  const conversation = await getConversation(conversationId);
  if (!conversation) return { ok: false as const, error: "That conversation is not in this workspace." };
  if (conversation.decided) {
    return { ok: false as const, error: "This conversation already has a recorded decision." };
  }
  const inbound =
    [...conversation.messages].reverse().find((message) => message.direction === "inbound")
      ?.body ?? "";
  if (!inbound.trim()) return { ok: false as const, error: "This conversation has no inbound message." };
  const ranked = await rankKnowledge(inbound);
  const knowledge = ranked.slice(0, 4).map((item) => ({
      chunkId: item.doc.id,
      orgId: MYCHEF_WORKSPACE,
      sourceId: item.doc.id,
      title: item.doc.title,
      kind: item.kind,
      excerpt: item.doc.content.slice(0, 700),
      score: item.score,
    }));
  const draft = localStructuredDraft(inbound, knowledge, []);
  const messageId = [...conversation.messages]
    .reverse()
    .find((message) => message.direction === "inbound")?.id;
  await query(
    `insert into mychef_inbox.drafts
       (workspace_id, conversation_id, body, author_id, kind, based_on_message_id, model, source_ids)
     values ($1, $2, $3, $4, 'ai', $5, 'local', $6::jsonb)`,
    [
      MYCHEF_WORKSPACE,
      conversationId,
      draft.draftText,
      authorId,
      messageId ?? null,
      JSON.stringify(draft.sourceRefs),
    ],
  );
  return { ok: true as const, draft };
}

function neonDecision(decision: HumanDecision): "approved" | "edited" | "rejected" {
  if (decision === "accepted") return "approved";
  if (decision === "edited") return "edited";
  return "rejected";
}

export async function reviewConversation(
  conversationId: string,
  authorId: string,
  input: {
    humanDecision: HumanDecision;
    reasonCode: string;
    rationale: string;
    whyNot: string;
    finalText: string;
  },
) {
  const conversation = await getConversation(conversationId);
  if (!conversation) return { ok: false as const, error: "That conversation is not in this workspace." };
  if (conversation.decided) return { ok: false as const, error: "This conversation was already reviewed." };
  if (!conversation.draft) return { ok: false as const, error: "Draft a reply before recording a decision." };
  const human = neonDecision(input.humanDecision);
  const client = await appPool.connect();
  try {
    await client.query("begin");
    const feedback = await client.query<{ id: string }>(
      `insert into mychef_inbox.feedback
         (workspace_id, conversation_id, scope, note, original_draft, edited_draft, author_id)
       values ($1, $2, 'conversation', $3, $4, $5, $6)
       returning id::text as id`,
      [
        MYCHEF_WORKSPACE,
        conversationId,
        input.rationale,
        conversation.draft.body,
        input.finalText.trim() || conversation.draft.body,
        authorId,
      ],
    );
    const feedbackId = feedback.rows[0]?.id;
    if (!feedbackId) throw new Error("feedback was not stored");
    const recorded = await client.query<{ id: string }>(
      `insert into mychef_inbox.decision_records
         (workspace_id, conversation_id, project_id, feedback_id, reason_code, rationale, why_not,
          rejected_alternative, human_decision, source_refs, author_id)
       values ($1, $2, $3, $4::uuid, $5, $6, $7, $8, $9, $11::jsonb, $10)
       returning id::text as id`,
      [
        MYCHEF_WORKSPACE,
        conversationId,
        conversation.project_id || "mychef",
        feedbackId,
        input.reasonCode,
        input.rationale,
        input.whyNot,
        input.humanDecision === "escalated" ? "escalated" : "",
        human,
        authorId,
        JSON.stringify(conversation.draft.source_ids ?? []),
      ],
    );
    const decisionId = recorded.rows[0]?.id;
    if (!decisionId) throw new Error("decision was not stored");
    await client.query(
      `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
       values ($1, $2, 'feedback', $3)`,
      [MYCHEF_WORKSPACE, authorId, decisionId],
    );
    await client.query("commit");
    return { ok: true as const, id: decisionId };
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error ? error.message : "Review was not saved.";
    return { ok: false as const, error: message.split("\n")[0] };
  } finally {
    client.release();
  }
}

export async function recordOutcome(decisionId: string, actorId: string, outcome: Outcome) {
  await query(
    `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
     values ($1, $2, $3, $4)`,
    [MYCHEF_WORKSPACE, actorId, `outcome:${outcome}`, decisionId],
  );
}

export type StoredKnowledge = {
  id: string;
  title: string;
  content: string;
  project_id: string;
  kind: "position" | "playbook";
  group: KnowledgeGroup;
};

export async function listStoredKnowledge(): Promise<StoredKnowledge[]> {
  const rows = await query<{
    id: string;
    title: string;
    content: string;
    project_id: string;
  }>(
    `select id, title, content, project_id
     from mychef_inbox.knowledge
     where workspace_id = $1
       and (
         ${LIBRARY_SOURCES_SQL}
         or (source = 'situational' and status = 'approved')
       )
     order by title`,
    [MYCHEF_WORKSPACE],
  );
  return rows.map((row) => ({
    ...row,
    kind: kindForTitle(row.title),
    group: groupForTitle(row.title, row.project_id),
  }));
}

export async function getStoredKnowledge(id: string) {
  const rows = await listStoredKnowledge();
  return rows.find((row) => row.id === id) ?? null;
}

export async function listKnowledgeDrafts() {
  const rows = await query<{
    id: string;
    title: string;
    status: string;
    project_id: string;
    source: string;
  }>(
    `select id, title, status, project_id, source
     from mychef_inbox.knowledge
     where workspace_id = $1 and ${LIBRARY_SOURCES_SQL}
     order by status, title`,
    [MYCHEF_WORKSPACE],
  );
  return rows.map((row) => ({
    ...row,
    group: groupForTitle(row.title, row.project_id),
  }));
}

export async function setKnowledgeStatus(
  id: string,
  status: "pending" | "approved" | "retired",
  actorId: string,
) {
  const updated = await query<{ id: string }>(
    `update mychef_inbox.knowledge
     set status = $3, updated_at = now(), version = version + 1
     where workspace_id = $1 and id = $2 and ${LIBRARY_SOURCES_SQL}
     returning id`,
    [MYCHEF_WORKSPACE, id, status],
  );
  if (updated.length === 0) return { ok: false as const, error: "That knowledge row is not in this workspace." };
  await query(
    `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
     values ($1, $2, $3, $4)`,
    [MYCHEF_WORKSPACE, actorId, `knowledge:${status}`, id],
  );
  return { ok: true as const };
}

export async function addPosition(input: {
  title: string;
  body: string;
  group: KnowledgeGroup;
}) {
  const id = `position-${crypto.randomUUID()}`;
  await query(
    `insert into mychef_inbox.knowledge
       (workspace_id, id, title, content, category, status, scope, source, version, project_id, area_id, created_at, updated_at)
     values ($1, $2, $3, $4, $5, 'pending', 'business', 'ledger-position', 1, 'mychef', 'general', now(), now())`,
    [MYCHEF_WORKSPACE, id, input.title.trim(), input.body.trim(), input.group],
  );
  return id;
}

type RuleRow = {
  id: string;
  title: string;
  content: string;
  status: string;
  category: string;
  updated_at: Date;
};

export async function listRuleCandidates(): Promise<RuleRow[]> {
  return query<RuleRow>(
    `select id, title, content, status, category, updated_at
     from mychef_inbox.knowledge
     where workspace_id = $1 and source in ('ledger-rule', 'learning-pass', 'situational')
     order by updated_at desc`,
    [MYCHEF_WORKSPACE],
  );
}

export type LearningQueueCard = {
  id: string;
  title: string;
  content: string;
  status: string;
  source: string;
  category: string;
  updatedAt: Date;
  queueType: QueueType;
  evidence: string;
  reason: string;
  snippet: string;
  diffs: { decisionId: string; ai: string; human: string; why: string }[];
};

export async function listLearningQueue(
  filter: QueueType | "all" = "all",
): Promise<LearningQueueCard[]> {
  const rows = await query<{
    id: string;
    title: string;
    content: string;
    status: string;
    source: string;
    category: string;
    updated_at: Date;
  }>(
    `select id, title, content, status, source, category, updated_at
     from mychef_inbox.knowledge
     where workspace_id = $1
       and source in ('ledger-rule', 'learning-pass', 'situational')
     order by
       case status when 'pending' then 0 when 'approved' then 1 else 2 end,
       updated_at desc`,
    [MYCHEF_WORKSPACE],
  );
  return rows
    .map((row) => {
      const meta = parseProposalMeta(row.content);
      return {
        id: row.id,
        title: row.title,
        content: row.content,
        status: row.status,
        source: row.source,
        category: row.category,
        updatedAt: row.updated_at,
        queueType: meta.queueType,
        evidence: meta.evidence,
        reason: meta.reason,
        snippet: meta.snippet || row.title,
        diffs: meta.diffs,
      };
    })
    .filter((card) => filter === "all" || card.queueType === filter);
}

export async function runMychefLearning(actorId: string) {
  const grouped = await query<{ reason_code: string; n: string }>(
    `select reason_code, count(*)::text as n
     from mychef_inbox.decision_records
     where workspace_id = $1
     group by reason_code`,
    [MYCHEF_WORKSPACE],
  );
  let created = 0;
  let goodAsDrafted = 0;
  for (const row of grouped) {
    if (row.reason_code === "good_as_drafted") {
      goodAsDrafted += Number(row.n);
      continue;
    }
    const proposal = statementFor(row.reason_code, Number(row.n));
    if (!proposal) continue;
    const id = `ledger-rule:${proposal.key}`;
    const existing = await query<{ status: string }>(
      `select status from mychef_inbox.knowledge where workspace_id = $1 and id = $2`,
      [MYCHEF_WORKSPACE, id],
    );
    if (existing[0]?.status === "retired" || existing[0]?.status === "approved") continue;
    const content = `evidence: ${row.n}\ngroup: ${proposal.group}\nreason: ${row.reason_code}\n\n${proposal.statement}`;
    if (existing[0]) {
      await query(
        `update mychef_inbox.knowledge
         set title = $3, content = $4, category = $5, status = 'pending', updated_at = now(), version = version + 1
         where workspace_id = $1 and id = $2`,
        [MYCHEF_WORKSPACE, id, proposal.statement, content, proposal.group],
      );
    } else {
      await query(
        `insert into mychef_inbox.knowledge
           (workspace_id, id, title, content, category, status, scope, source, version, project_id, area_id, created_at, updated_at)
         values ($1, $2, $3, $4, $5, 'pending', 'business', 'ledger-rule', 1, 'mychef', 'general', now(), now())`,
        [MYCHEF_WORKSPACE, id, proposal.statement, content, proposal.group],
      );
      created += 1;
    }
  }
  const decay = await query(
    `update mychef_inbox.knowledge k
     set status = 'retired', updated_at = now()
     where k.workspace_id = $1
       and k.source = 'ledger-rule'
       and k.status = 'approved'
       and k.updated_at < now() - interval '90 days'
     returning id`,
    [MYCHEF_WORKSPACE],
  );
  return { created, goodAsDrafted, decayed: decay.length };
}

/**
 * CBLS nightly / manual learning pass.
 * Clusters unprocessed decision_records (last 30 days) by reason_code.
 * Writes pending learning-pass or ledger-rule rows with AI vs human diffs.
 * Marks each clustered decision with audit learn:processed (idempotent).
 * Does not approve, does not touch curated library rows, does not send.
 */
/** Corrections that feed the Learning Queue: edits, or rejects with a learnable reason. */
const LEARNABLE_DECISIONS_SQL = `
  d.created_at >= now() - interval '30 days'
  and d.reason_code <> 'auto_sent_candidate'
  and (
    d.human_decision = 'edited'
    or (d.human_decision = 'rejected' and d.reason_code <> 'good_as_drafted')
  )
`;

export async function runLearningPass(actorId: string, db: Db = appPool) {
  const grouped = await rows<{ reason_code: string; n: string }>(
    db,
    `select d.reason_code, count(*)::text as n
     from mychef_inbox.decision_records d
     join mychef_inbox.feedback f on f.id = d.feedback_id
     where d.workspace_id = $1
       and ${LEARNABLE_DECISIONS_SQL}
       and not exists (
         select 1 from mychef_inbox.audit_log a
         where a.workspace_id = d.workspace_id
           and a.record_id = d.id::text
           and a.action = 'learn:processed'
       )
     group by d.reason_code`,
    [MYCHEF_WORKSPACE],
  );

  let proposed = 0;
  let refreshed = 0;
  let skippedGood = 0;
  let clustered = 0;
  let processed = 0;

  for (const row of grouped) {
    const count = Number(row.n);
    if (row.reason_code === "good_as_drafted" || !isLearnableReason(row.reason_code)) {
      skippedGood += count;
      continue;
    }

    const proposal = statementFor(row.reason_code, count);
    if (!proposal) continue;
    clustered += 1;

    const evidenceRows = await rows<{
      id: string;
      original_draft: string;
      edited_draft: string;
      rationale: string;
    }>(
      db,
      `select d.id::text as id, f.original_draft, f.edited_draft, d.rationale
       from mychef_inbox.decision_records d
       join mychef_inbox.feedback f on f.id = d.feedback_id
       where d.workspace_id = $1
         and d.reason_code = $2
         and ${LEARNABLE_DECISIONS_SQL}
         and not exists (
           select 1 from mychef_inbox.audit_log a
           where a.workspace_id = d.workspace_id
             and a.record_id = d.id::text
             and a.action = 'learn:processed'
         )
       order by d.created_at desc
       limit 3`,
      [MYCHEF_WORKSPACE, row.reason_code],
    );

    const source = isKnowledgeGapReason(row.reason_code) ? "learning-pass" : "ledger-rule";
    const id = `${source}:${proposal.key}`;
    const queueType = queueTypeForReason(row.reason_code);
    const whyLead = evidenceRows[0]?.rationale?.trim() ?? "";
    const snippet = learningSnippet(row.reason_code, whyLead, proposal.statement);
    const content = buildProposalContent({
      evidence: count,
      group: proposal.group,
      reason: row.reason_code,
      queueType,
      snippet,
      diffs: evidenceRows.map((item) => ({
        decisionId: item.id,
        ai: item.original_draft.slice(0, 800),
        human: item.edited_draft.slice(0, 800),
        why: item.rationale.slice(0, 400),
      })),
    });

    const outcome = await proposePendingRow(db, {
      id,
      source,
      title: snippet,
      content,
      category: queueType,
    });
    if (outcome === "created") proposed += 1;
    if (outcome === "refreshed") refreshed += 1;

    const allIds = await rows<{ id: string }>(
      db,
      `select d.id::text as id
       from mychef_inbox.decision_records d
       where d.workspace_id = $1
         and d.reason_code = $2
         and ${LEARNABLE_DECISIONS_SQL}
         and not exists (
           select 1 from mychef_inbox.audit_log a
           where a.workspace_id = d.workspace_id
             and a.record_id = d.id::text
             and a.action = 'learn:processed'
         )`,
      [MYCHEF_WORKSPACE, row.reason_code],
    );
    for (const item of allIds) {
      await rows(
        db,
        `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
         values ($1, $2, 'learn:processed', $3)`,
        [MYCHEF_WORKSPACE, actorId, item.id],
      );
      processed += 1;
    }
  }

  await rows(
    db,
    `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
     values ($1, $2, 'learn:pass', $3)`,
    [MYCHEF_WORKSPACE, actorId, `clustered:${clustered}:proposed:${proposed}:processed:${processed}`],
  );

  return {
    clustered,
    proposed,
    refreshed,
    skippedGood,
    processed,
    sent: false as const,
    activated: false as const,
  };
}

async function proposePendingRow(
  db: Db,
  input: {
    id: string;
    source: "ledger-rule" | "learning-pass";
    title: string;
    content: string;
    category: string;
  },
) {
  const existing = await rows<{ status: string; source: string }>(
    db,
    `select status, source from mychef_inbox.knowledge where workspace_id = $1 and id = $2`,
    [MYCHEF_WORKSPACE, input.id],
  );
  const row = existing[0];
  if (row && row.status === "approved") return "left" as const;
  if (row && row.source !== input.source) return "left" as const;
  if (row) {
    // Refresh pending cards, or reopen a dismissed (retired) card for new evidence.
    await rows(
      db,
      `update mychef_inbox.knowledge
       set title = $3, content = $4, category = $5, status = 'pending', updated_at = now(), version = version + 1
       where workspace_id = $1 and id = $2 and source = $6 and status in ('pending', 'retired')`,
      [MYCHEF_WORKSPACE, input.id, input.title, input.content, input.category, input.source],
    );
    return "refreshed" as const;
  }
  await rows(
    db,
    `insert into mychef_inbox.knowledge
       (workspace_id, id, title, content, category, status, scope, source, version, project_id, area_id, created_at, updated_at)
     values ($1, $2, $3, $4, $5, 'pending', 'business', $6, 1, 'mychef', 'general', now(), now())`,
    [MYCHEF_WORKSPACE, input.id, input.title, input.content, input.category, input.source],
  );
  return "created" as const;
}

/**
 * Immediate correct→learn path from inbox.
 * After an edit/reject with a learnable reason, upsert one pending Learning Queue
 * card with AI vs human vs why evidence, mark the decision learn:processed.
 * Never approves, never touches the curated 12, never sends.
 */
export async function proposeFromDecision(decisionId: string, actorId: string) {
  const found = await query<{
    id: string;
    reason_code: string;
    human_decision: string;
    rationale: string;
    original_draft: string;
    edited_draft: string;
  }>(
    `select d.id::text as id, d.reason_code, d.human_decision, d.rationale,
            f.original_draft, f.edited_draft
     from mychef_inbox.decision_records d
     join mychef_inbox.feedback f on f.id = d.feedback_id
     where d.workspace_id = $1 and d.id = $2::uuid`,
    [MYCHEF_WORKSPACE, decisionId],
  );
  const decision = found[0];
  if (!decision) return { ok: false as const, error: "That decision is not in this workspace." };

  const already = await query<{ id: string }>(
    `select id::text as id from mychef_inbox.audit_log
     where workspace_id = $1 and record_id = $2 and action = 'learn:processed'
     limit 1`,
    [MYCHEF_WORKSPACE, decision.id],
  );
  if (already[0]) {
    const source = isKnowledgeGapReason(decision.reason_code) ? "learning-pass" : "ledger-rule";
    return {
      ok: true as const,
      queued: false as const,
      id: `${source}:${decision.reason_code}`,
      queueType: queueTypeForReason(decision.reason_code),
    };
  }

  if (
    !isLearnableReason(decision.reason_code) ||
    (decision.human_decision !== "edited" && decision.human_decision !== "rejected")
  ) {
    await query(
      `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
       values ($1, $2, 'learn:processed', $3)`,
      [MYCHEF_WORKSPACE, actorId, decision.id],
    );
    return { ok: true as const, queued: false as const, id: null, queueType: null };
  }

  const proposal = statementFor(decision.reason_code, 1);
  if (!proposal) {
    return { ok: false as const, error: "That reason does not map to a Learning Queue card." };
  }

  const source = isKnowledgeGapReason(decision.reason_code) ? "learning-pass" : "ledger-rule";
  const id = `${source}:${proposal.key}`;
  const queueType = queueTypeForReason(decision.reason_code);
  const newDiff: EvidenceDiff = {
    decisionId: decision.id,
    ai: decision.original_draft.slice(0, 800),
    human: decision.edited_draft.slice(0, 800),
    why: decision.rationale.slice(0, 400),
  };

  const existing = await query<{ content: string; status: string; source: string }>(
    `select content, status, source from mychef_inbox.knowledge
     where workspace_id = $1 and id = $2`,
    [MYCHEF_WORKSPACE, id],
  );
  const prior = existing[0];
  if (prior && prior.status === "approved") {
    await query(
      `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
       values ($1, $2, 'learn:processed', $3)`,
      [MYCHEF_WORKSPACE, actorId, decision.id],
    );
    return {
      ok: true as const,
      queued: false as const,
      id,
      queueType,
      skipped: "already_approved" as const,
    };
  }

  let diffs = [newDiff];
  let evidenceCount = 1;
  if (prior && prior.source === source && (prior.status === "pending" || prior.status === "retired")) {
    const meta = parseProposalMeta(prior.content);
    diffs = [newDiff, ...meta.diffs.filter((d) => d.decisionId !== decision.id)].slice(
      0,
      3,
    );
    const priorEvidence = Number(meta.evidence);
    evidenceCount =
      prior.status === "retired"
        ? 1
        : Number.isFinite(priorEvidence)
          ? priorEvidence + 1
          : diffs.length;
  }

  const snippet = learningSnippet(decision.reason_code, decision.rationale, proposal.statement);
  const content = buildProposalContent({
    evidence: evidenceCount,
    group: proposal.group,
    reason: decision.reason_code,
    queueType,
    snippet,
    diffs,
  });

  await proposePendingRow(appPool, {
    id,
    source,
    title: snippet,
    content,
    category: queueType,
  });
  await query(
    `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
     values ($1, $2, 'learn:processed', $3)`,
    [MYCHEF_WORKSPACE, actorId, decision.id],
  );
  await query(
    `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
     values ($1, $2, 'learn:from-inbox', $3)`,
    [MYCHEF_WORKSPACE, actorId, id],
  );

  return { ok: true as const, queued: true as const, id, queueType };
}

function statementFor(reason: string, count: number): { key: string; group: string; statement: string } | null {
  if (["wrong_policy", "wrong_fact", "missing_knowledge"].includes(reason)) {
    return {
      key: reason,
      group: "knowledge_gap",
      statement: `When this case repeats, state the missing position clearly. Reviewers marked ${reason} ${count} times.`,
    };
  }
  if (
    ["too_formal", "too_casual", "should_have_asked", "missed_upsell", "customer_angry"].includes(
      reason,
    )
  ) {
    return {
      key: reason,
      group: "procedure_gap",
      statement: `Match the human tone and procedure for this situation. Reviewers marked ${reason} ${count} times.`,
    };
  }
  if (reason === "needs_human") {
    return {
      key: reason,
      group: "escalation",
      statement: `Escalate this class of request to a person. Reviewers marked needs_human ${count} times.`,
    };
  }
  if (reason === "irrelevant_source") {
    return {
      key: reason,
      group: "retrieval",
      statement: `Do not lean on the cited source for this tag. Reviewers marked irrelevant_source ${count} times.`,
    };
  }
  return null;
}

/** Approve → situational knowledge. Dismiss → retired. Never edits the curated 12. */
export async function setMychefRuleStatus(
  id: string,
  status: "approved" | "retired",
  actorId: string,
) {
  const rows = await query<{ title: string; content: string; status: string; source: string }>(
    `select title, content, status, source from mychef_inbox.knowledge
     where workspace_id = $1 and id = $2 and source in ('ledger-rule', 'learning-pass', 'situational')`,
    [MYCHEF_WORKSPACE, id],
  );
  const rule = rows[0];
  if (!rule) return { ok: false as const, error: "That candidate is not in this workspace." };
  if (status === "approved" && rule.status !== "pending") {
    return { ok: false as const, error: "Only a pending snippet can be approved." };
  }
  if (status === "approved") {
    await query(
      `update mychef_inbox.knowledge
       set status = 'approved', source = 'situational', updated_at = now(), version = version + 1
       where workspace_id = $1 and id = $2 and source in ('ledger-rule', 'learning-pass') and status = 'pending'`,
      [MYCHEF_WORKSPACE, id],
    );
    await query(
      `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
       values ($1, $2, 'snippet:approved', $3)`,
      [MYCHEF_WORKSPACE, actorId, id],
    );
  } else {
    await query(
      `update mychef_inbox.knowledge
       set status = 'retired', updated_at = now(), version = version + 1
       where workspace_id = $1 and id = $2 and source in ('ledger-rule', 'learning-pass', 'situational')`,
      [MYCHEF_WORKSPACE, id],
    );
    await query(
      `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
       values ($1, $2, 'snippet:dismissed', $3)`,
      [MYCHEF_WORKSPACE, actorId, id],
    );
  }
  return { ok: true as const, title: rule.title, content: rule.content };
}

const EVALS = [
  {
    name: "Deposit inside 14 days",
    inbound: "Can I get the deposit back? The dinner is in five days.",
    mustInclude: "non-refundable",
    mustNotInclude: "full refund",
  },
  {
    name: "Allergy",
    inbound: "My guest has a severe allergy. Can you still cook?",
    mustInclude: "allergy",
    mustNotInclude: "we cannot accommodate",
  },
];

export async function runMychefEvals(actorId: string) {
  const results: { name: string; passed: boolean; notes: string }[] = [];
  for (const item of EVALS) {
    const ranked = await rankKnowledge(item.inbound);
    const knowledge = ranked.slice(0, 4).map((row) => ({
      chunkId: row.doc.id,
      orgId: MYCHEF_WORKSPACE,
      sourceId: row.doc.id,
      title: row.doc.title,
      kind: row.kind,
      excerpt: row.doc.content.slice(0, 700),
      score: row.score,
    }));
    const draft = localStructuredDraft(item.inbound, knowledge, []);
    const passed =
      draft.draftText.toLowerCase().includes(item.mustInclude.toLowerCase()) &&
      !draft.draftText.toLowerCase().includes(item.mustNotInclude.toLowerCase());
    const notes = passed
      ? "Draft matched the case. No provider was called."
      : "Draft did not match the case. No provider was called.";
    await query(
      `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
       values ($1, $2, $3, $4)`,
      [MYCHEF_WORKSPACE, actorId, passed ? "eval:pass" : "eval:fail", item.name],
    );
    results.push({ name: item.name, passed, notes });
  }
  return results;
}

export async function listAudit() {
  return query<{ id: string; actor_id: string; action: string; record_id: string; created_at: Date }>(
    `select id::text as id, actor_id, action, record_id, created_at
     from mychef_inbox.audit_log
     where workspace_id = $1
     order by created_at desc
     limit 80`,
    [MYCHEF_WORKSPACE],
  );
}

export async function listMychefKeys() {
  const rows = await query<{
    id: string;
    enabled: boolean;
    config: { hint?: string; base_url?: string } | null;
    updated_at: Date;
  }>(
    `select id, enabled, config, updated_at
     from mychef_inbox.integration_connections
     where workspace_id = $1 and kind = 'ai' and id = any($2::text[])
     order by id`,
    [MYCHEF_WORKSPACE, PROVIDERS],
  );
  return rows;
}

export async function saveMychefKey(
  provider: Provider,
  secret: string,
  baseUrl: string | null,
) {
  const trimmed = secret.trim();
  if (trimmed.length < 8) return { ok: false as const, error: "Enter the provider key. It stays on the server." };
  const hint = keyHint(trimmed);
  const encoded = encryptSecret(trimmed).toString("base64");
  await query(
    `insert into mychef_inbox.integration_connections
       (workspace_id, id, kind, label, encrypted_secret, config, enabled, updated_at)
     values ($1, $2, 'ai', $3, $4, $5::jsonb, true, now())
     on conflict (workspace_id, id) do update
       set encrypted_secret = excluded.encrypted_secret,
           config = excluded.config,
           enabled = true,
           label = excluded.label,
           updated_at = now()`,
    [
      MYCHEF_WORKSPACE,
      provider,
      provider,
      encoded,
      JSON.stringify({ hint, base_url: baseUrl }),
    ],
  );
  return { ok: true as const, hint };
}

export async function revokeMychefKey(provider: Provider) {
  const updated = await query(
    `update mychef_inbox.integration_connections
     set enabled = false, updated_at = now()
     where workspace_id = $1 and id = $2 and kind = 'ai'
     returning id`,
    [MYCHEF_WORKSPACE, provider],
  );
  if (updated.length === 0) return { ok: false as const, error: "No key is stored for that provider." };
  return { ok: true as const };
}

export async function resolveMychefSecret(provider: Provider): Promise<{
  secret: string;
  baseUrl: string | null;
} | null> {
  const rows = await query<{ encrypted_secret: string; config: { base_url?: string } | null }>(
    `select encrypted_secret, config
     from mychef_inbox.integration_connections
     where workspace_id = $1 and id = $2 and kind = 'ai' and enabled = true`,
    [MYCHEF_WORKSPACE, provider],
  );
  const row = rows[0];
  if (!row?.encrypted_secret) return null;
  return {
    secret: decryptSecret(Buffer.from(row.encrypted_secret, "base64")),
    baseUrl: row.config?.base_url ?? null,
  };
}

export async function markMychefKeyChecked(provider: Provider, error: string | null) {
  if (error) {
    await query(
      `update mychef_inbox.integration_connections
       set last_error = $3, updated_at = now()
       where workspace_id = $1 and id = $2`,
      [MYCHEF_WORKSPACE, provider, error.slice(0, 240)],
    );
    return;
  }
  await query(
    `update mychef_inbox.integration_connections
     set verified_at = now(), last_error = null, updated_at = now()
     where workspace_id = $1 and id = $2`,
    [MYCHEF_WORKSPACE, provider],
  );
}
