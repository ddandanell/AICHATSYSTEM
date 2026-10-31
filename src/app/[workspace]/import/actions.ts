"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appPool } from "@/db/client";
import { usesMychefInbox } from "@/db/mode";
import { getWorkspaceAccess } from "@/lib/context";
import { markArchiveCurated, readArchiveText, storeArchive } from "@/lib/raw-archive";
import { canReview } from "@/lib/workspace-access";

function importPath(slug: string, query: Record<string, string>) {
  const params = new URLSearchParams(query);
  return `/${slug}/import?${params.toString()}`;
}

export async function importArchiveAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok" || !canReview(access.ctx.role)) {
    redirect(importPath(slug || "mychef", { error: "You cannot import into this workspace." }));
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(importPath(slug, { error: "Choose a zip, json, or markdown export." }));
  }
  let stored;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    stored = await storeArchive(file.name || "export", bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The export was not stored.";
    redirect(importPath(slug, { error: message }));
  }
  revalidatePath(`/${slug}/import`);
  redirect(
    importPath(slug, {
      stored: stored.filename,
      files: String(stored.files.length),
    }),
  );
}

export async function curateArchiveAction(slug: string, formData: FormData) {
  const access = await getWorkspaceAccess(slug);
  if (access.status !== "ok" || !canReview(access.ctx.role)) return;
  if (!usesMychefInbox()) return;
  const id = String(formData.get("id") ?? "");
  if (!id.startsWith("import-")) return;
  const text = await readArchiveText(id);
  if (!text.trim()) return;
  const knowledgeId = `curated-${id}`;
  const title = `Imported archive ${id.slice(0, 18)}`;
  const inserted = await appPool.query(
    `insert into mychef_inbox.knowledge
       (workspace_id, id, title, content, category, status, scope, source, version, project_id, area_id, created_at, updated_at)
     select $1, $2, $3, $4, 'Imported archive', 'pending', 'business', $5, 1, 'mychef', 'general', now(), now()
     where not exists (
       select 1 from mychef_inbox.knowledge
       where workspace_id = $1 and (id = $2 or source = $5)
     )
     returning id`,
    ["mychef", knowledgeId, title, text, `import:${id}`],
  );
  if ((inserted.rowCount ?? 0) > 0) await markArchiveCurated(id, knowledgeId);
  revalidatePath(`/${slug}/import`);
  revalidatePath(`/${slug}/knowledge`);
}
