import { appPool } from "@/db/client";
import { MYCHEF_WORKSPACE } from "@/data/mychef-store";
import { tagsFromFacts, type InboxTag } from "@/lib/inbox-tags";
import { draftMeta } from "@/lib/inbox-tags";

export type InboxFilter = "all" | "needs_review" | "auto_sent" | "escalated";

export type InboxCard = {
  id: string;
  name: string;
  snippet: string;
  at: string | null;
  tags: InboxTag[];
  confidence: number | null;
  channel: string;
  bucket: "needs_review" | "auto_sent" | "escalated" | "other";
};

type BoardRow = {
  id: string;
  name: string | null;
  facts: { tags?: string[] } | null;
  channel: string | null;
  status: string;
  last_message_at: Date | null;
  snippet: string | null;
  prompt_version: string | null;
  reason_code: string | null;
  human_decision: string | null;
};

function bucketOf(row: BoardRow): InboxCard["bucket"] {
  if (row.reason_code === "auto_sent_candidate") return "auto_sent";
  if (row.reason_code === "needs_human" || row.human_decision === "rejected" && row.reason_code === "needs_human") {
    return "escalated";
  }
  if (row.reason_code === "needs_human") return "escalated";
  if (!row.human_decision) return "needs_review";
  return "other";
}

export async function listInboxBoard(search: string, filter: InboxFilter): Promise<InboxCard[]> {
  const needle = search.trim().replace(/[%_]/g, "");
  const result = await appPool.query<BoardRow>(
    `select c.id,
            ct.name,
            ct.facts,
            c.channel,
            c.status,
            c.last_message_at,
            left(coalesce(m.body, ''), 160) as snippet,
            dr.prompt_version,
            d.reason_code,
            d.human_decision
     from mychef_inbox.conversations c
     join mychef_inbox.contacts ct
       on ct.workspace_id = c.workspace_id and ct.id = c.contact_id
     left join lateral (
       select body from mychef_inbox.messages
       where workspace_id = c.workspace_id and conversation_id = c.id and direction = 'inbound'
       order by created_at desc limit 1
     ) m on true
     left join lateral (
       select prompt_version from mychef_inbox.drafts
       where workspace_id = c.workspace_id and conversation_id = c.id
       order by created_at desc limit 1
     ) dr on true
     left join lateral (
       select reason_code, human_decision from mychef_inbox.decision_records
       where workspace_id = c.workspace_id and conversation_id = c.id
       order by created_at desc limit 1
     ) d on true
     where c.workspace_id = $1
       and ($2::text = '' or ct.name ilike '%' || $2 || '%' or coalesce(m.body, '') ilike '%' || $2 || '%')
     order by c.last_message_at desc nulls last
     limit 80`,
    [MYCHEF_WORKSPACE, needle],
  );
  const cards = result.rows.map((row) => {
    const meta = draftMeta(row.prompt_version);
    const snippet = row.snippet ?? "";
    return {
      id: row.id,
      name: row.name ?? "Guest",
      snippet,
      at: row.last_message_at ? row.last_message_at.toISOString() : null,
      tags: tagsFromFacts(row.facts, snippet),
      confidence: meta.confidence,
      channel: row.channel ?? "",
      bucket: bucketOf(row),
    };
  });
  if (filter === "all") return cards.filter((card) => card.bucket !== "other");
  return cards.filter((card) => card.bucket === filter);
}

export async function setContactTags(contactId: string, tags: InboxTag[]) {
  await appPool.query(
    `update mychef_inbox.contacts
     set facts = coalesce(facts, '{}'::jsonb) || jsonb_build_object('tags', $3::jsonb)
     where workspace_id = $1 and id = $2`,
    [MYCHEF_WORKSPACE, contactId, JSON.stringify(tags)],
  );
}
