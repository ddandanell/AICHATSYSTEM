import { sql } from "drizzle-orm";
import { withTenant } from "@/db/tenant";
import { embedText, toVectorLiteral } from "@/lib/embed";

export type RetrievedItem = {
  chunkId: string;
  orgId: string;
  kind: "position" | "playbook" | "decision";
  sourceId: string;
  title: string;
  excerpt: string;
  score: number;
};

type RetrievedRow = {
  chunk_id: string;
  org_id: string;
  kind: RetrievedItem["kind"];
  source_id: string;
  title: string;
  excerpt: string;
  score: number | string;
};

function vectorLiteral(text: string) {
  return sql.raw(`'${toVectorLiteral(embedText(text))}'::vector`);
}

function mapRow(row: RetrievedRow, orgId: string): RetrievedItem {
  if (row.org_id !== orgId) {
    throw new Error("retrieval returned a row from another workspace");
  }
  const score = typeof row.score === "number" ? row.score : Number(row.score);
  return {
    chunkId: row.chunk_id,
    orgId: row.org_id,
    kind: row.kind,
    sourceId: row.source_id,
    title: row.title,
    excerpt: row.excerpt,
    score: Number.isFinite(score) ? score : 0,
  };
}

export async function retrieveForDecision(orgId: string, decisionId: string, query: string) {
  const embedded = vectorLiteral(query);
  return withTenant(orgId, async (tx) => {
    const knowledgeResult = await tx.execute<RetrievedRow>(sql`
      select c.id as chunk_id,
             c.org_id,
             d.kind,
             d.source_id,
             d.title,
             left(c.body, 320) as excerpt,
             (1 - (c.embedding <=> ${embedded}))::float8 as score
      from chunks c
      join documents d on d.org_id = c.org_id and d.id = c.document_id
      where d.kind in ('position', 'playbook')
      order by c.embedding <=> ${embedded}
      limit 4
    `);
    const decisionResult = await tx.execute<RetrievedRow>(sql`
      select c.id as chunk_id,
             c.org_id,
             d.kind,
             d.source_id,
             d.title,
             left(c.body, 320) as excerpt,
             (1 - (c.embedding <=> ${embedded}))::float8 as score
      from chunks c
      join documents d on d.org_id = c.org_id and d.id = c.document_id
      where d.kind = 'decision'
        and d.source_id <> ${decisionId}
      order by c.embedding <=> ${embedded}
      limit 3
    `);
    return {
      knowledge: knowledgeResult.rows.map((row) => mapRow(row, orgId)),
      decisions: decisionResult.rows.map((row) => mapRow(row, orgId)),
    };
  });
}
