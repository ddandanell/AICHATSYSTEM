import { appPool } from "@/db/client";
import { decryptSecret, encryptSecret, keyHint } from "@/lib/crypto";
import { localStructuredDraft } from "@/lib/draft";
import { tokenize } from "@/lib/embed";
import { groupForTitle, type KnowledgeGroup } from "@/lib/knowledge-groups";
import type { Provider } from "@/lib/providers";
import { PROVIDERS } from "@/lib/providers";
import type { HumanDecision, Outcome } from "@/lib/reason-codes";

export const MYCHEF_WORKSPACE = "mychef";

type QueryResult<T> = T[];

async function query<T>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const result = await appPool.query(text, params);
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
       (select count(*) from mychef_inbox.knowledge where workspace_id = $1 and source is distinct from 'ledger-rule') as knowledge,
       (select count(*) from mychef_inbox.conversations c
         where c.workspace_id = $1 and c.status = 'needs_reply'
           and not exists (
             select 1 from mychef_inbox.decision_records d
             where d.workspace_id = c.workspace_id and d.conversation_id = c.id
           )) as needs_reply,
       (select count(*) from mychef_inbox.decision_records where workspace_id = $1) as decisions,
       (select count(*) from mychef_inbox.knowledge where workspace_id = $1 and source = 'ledger-rule' and status = 'pending') as candidates`,
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

export async function listInbox(status: "pending_review" | "reviewed") {
  if (status === "reviewed") {
    return query<{
      id: string;
      inbound: string | null;
      draft: string | null;
      human_decision: string;
      reason_code: string;
      created_at: Date;
    }>(
      `select d.id::text as id,
              left(m.body, 180) as inbound,
              left(f.original_draft, 180) as draft,
              d.human_decision,
              d.reason_code,
              d.created_at
       from mychef_inbox.decision_records d
       join mychef_inbox.feedback f on f.id = d.feedback_id
       left join lateral (
         select body from mychef_inbox.messages
         where workspace_id = d.workspace_id
           and conversation_id = d.conversation_id
           and direction = 'inbound'
         order by created_at desc
         limit 1
       ) m on true
       where d.workspace_id = $1
       order by d.created_at desc
       limit 40`,
      [MYCHEF_WORKSPACE],
    );
  }
  const rows = await query<{
    id: string;
    name: string | null;
    inbound: string | null;
    draft: string | null;
    last_message_at: Date | null;
    waiting: string;
  }>(
    `select c.id,
            ct.name,
            left(m.body, 180) as inbound,
            left(dr.body, 180) as draft,
            c.last_message_at,
            (select count(*) from mychef_inbox.conversations c2
              where c2.workspace_id = $1 and c2.status = 'needs_reply'
                and not exists (
                  select 1 from mychef_inbox.decision_records d
                  where d.workspace_id = c2.workspace_id and d.conversation_id = c2.id
                ))::text as waiting
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
       and not exists (
         select 1 from mychef_inbox.decision_records d
         where d.workspace_id = c.workspace_id and d.conversation_id = c.id
       )
     order by c.last_message_at desc nulls last
     limit 40`,
    [MYCHEF_WORKSPACE],
  );
  return rows;
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
  const drafts = await query<{ id: string; body: string; model: string | null; created_at: Date }>(
    `select id::text as id, body, model, created_at
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
     where workspace_id = $1 and source is distinct from 'ledger-rule'`,
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
       values ($1, $2, $3, $4::uuid, $5, $6, $7, $8, $9, '[]'::jsonb, $10)
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
     where workspace_id = $1 and source is distinct from 'ledger-rule'
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
     where workspace_id = $1 and source = 'ledger-rule'
     order by updated_at desc`,
    [MYCHEF_WORKSPACE],
  );
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

function statementFor(reason: string, count: number): { key: string; group: string; statement: string } | null {
  if (["wrong_policy", "wrong_fact", "missing_knowledge"].includes(reason)) {
    return {
      key: reason,
      group: "knowledge_gap",
      statement: `Propose a position edit. Reviewers marked ${reason} ${count} times.`,
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
      statement: `Propose a playbook edit. Reviewers marked ${reason} ${count} times.`,
    };
  }
  if (reason === "needs_human") {
    return {
      key: reason,
      group: "escalation",
      statement: `Propose an escalation rule. Reviewers marked needs_human ${count} times.`,
    };
  }
  if (reason === "irrelevant_source") {
    return {
      key: reason,
      group: "retrieval",
      statement: `Penalize irrelevant sources. Reviewers marked irrelevant_source ${count} times.`,
    };
  }
  return null;
}

export async function setMychefRuleStatus(
  id: string,
  status: "approved" | "retired",
  actorId: string,
) {
  const rows = await query<{ title: string; content: string; status: string }>(
    `select title, content, status from mychef_inbox.knowledge
     where workspace_id = $1 and id = $2 and source = 'ledger-rule'`,
    [MYCHEF_WORKSPACE, id],
  );
  const rule = rows[0];
  if (!rule) return { ok: false as const, error: "That candidate is not in this workspace." };
  if (status === "approved" && rule.status !== "pending") {
    return { ok: false as const, error: "Only a candidate can be activated." };
  }
  await query(
    `update mychef_inbox.knowledge set status = $3, updated_at = now()
     where workspace_id = $1 and id = $2`,
    [MYCHEF_WORKSPACE, id, status],
  );
  await query(
    `insert into mychef_inbox.audit_log (workspace_id, actor_id, action, record_id)
     values ($1, $2, $3, $4)`,
    [MYCHEF_WORKSPACE, actorId, `rule:${status}`, id],
  );
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
