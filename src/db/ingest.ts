import type pg from "pg";
import { chunkBody, embedText, toVectorLiteral } from "../lib/embed";
import { listKnowledge } from "../lib/knowledge";
import { HARBOR_ORG_ID, NORTHLINE_ORG_ID } from "./ids";

const SEEDED_ORGS = [HARBOR_ORG_ID, NORTHLINE_ORG_ID];

type DecisionRow = {
  id: string;
  org_id: string;
  draft_text: string;
  final_text: string | null;
  inbound: string;
};

async function insertDocument(
  client: pg.Client,
  input: {
    orgId: string;
    kind: "position" | "playbook" | "decision";
    sourceId: string;
    title: string;
    body: string;
  },
) {
  const inserted = await client.query<{ id: string }>(
    `insert into documents (org_id, kind, source_id, title, body)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [input.orgId, input.kind, input.sourceId, input.title, input.body],
  );
  const documentId = inserted.rows[0]?.id;
  if (!documentId) throw new Error("document insert did not return an id");
  const pieces = chunkBody(input.title, input.body);
  for (let ordinal = 0; ordinal < pieces.length; ordinal += 1) {
    const piece = pieces[ordinal];
    await client.query(
      `insert into chunks (org_id, document_id, ordinal, body, embedding)
       values ($1, $2, $3, $4, $5::vector)`,
      [input.orgId, documentId, ordinal, piece, toVectorLiteral(embedText(piece))],
    );
  }
  return pieces.length;
}

export async function ingestRetrieval(client: pg.Client) {
  const knowledge = listKnowledge();
  const decisions = await client.query<DecisionRow>(
    `select d.id, d.org_id, d.draft_text, d.final_text, m.body as inbound
     from decision_records d
     join raw_messages m on m.id = d.inbound_message_id
     where d.org_id = any($1::uuid[])`,
    [SEEDED_ORGS],
  );

  await client.query("begin");
  try {
    await client.query(`delete from documents where org_id = any($1::uuid[])`, [SEEDED_ORGS]);
    let documents = 0;
    let chunks = 0;
    for (const orgId of SEEDED_ORGS) {
      for (const doc of knowledge) {
        chunks += await insertDocument(client, {
          orgId,
          kind: doc.kind,
          sourceId: doc.id,
          title: doc.title,
          body: doc.body,
        });
        documents += 1;
      }
      for (const decision of decisions.rows.filter((row) => row.org_id === orgId)) {
        const title = decision.inbound.replace(/\s+/g, " ").trim().slice(0, 80);
        const body = [
          decision.inbound.trim(),
          "",
          "Draft",
          decision.draft_text.trim(),
          decision.final_text?.trim() ? `Final\n${decision.final_text.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        chunks += await insertDocument(client, {
          orgId,
          kind: "decision",
          sourceId: decision.id,
          title: title || "Past decision",
          body,
        });
        documents += 1;
      }
    }
    await client.query("commit");
    console.log(`ingested ${documents} documents and ${chunks} chunks`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
