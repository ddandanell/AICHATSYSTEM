/**
 * Lists local documents for one org. Do not auto-send.
 */
import { asc, eq } from "drizzle-orm";
import { documents } from "@/db/schema";
import { withTenant } from "@/db/tenant";

export type WorkspaceDocument = {
  id: string;
  kind: "position" | "playbook" | "decision";
  sourceId: string;
  title: string;
  body?: string;
};

export async function listOrgDocuments(orgId: string): Promise<WorkspaceDocument[]> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: documents.id,
        kind: documents.kind,
        sourceId: documents.sourceId,
        title: documents.title,
      })
      .from(documents)
      .where(eq(documents.orgId, orgId))
      .orderBy(asc(documents.kind), asc(documents.title));
    return rows;
  });
}

export async function getOrgDocument(
  orgId: string,
  id: string,
): Promise<WorkspaceDocument | null> {
  return withTenant(orgId, async (tx) => {
    const rows = await tx
      .select({
        id: documents.id,
        kind: documents.kind,
        sourceId: documents.sourceId,
        title: documents.title,
        body: documents.body,
      })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return rows[0] ?? null;
  });
}
