import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownBody } from "@/components/markdown-body";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { getWorkspaceAccess } from "@/lib/context";
import { getKnowledge } from "@/lib/knowledge";

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/knowledge/[id]">) {
  const { id } = await params;
  const doc = getKnowledge(id);
  return { title: doc?.title ?? "Knowledge" };
}

export default async function KnowledgeDocPage({
  params,
}: PageProps<"/[workspace]/knowledge/[id]">) {
  const { workspace, id } = await params;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const doc = getKnowledge(id);
  if (!doc) notFound();

  return (
    <article className="flex max-w-2xl flex-col gap-5">
      <Link
        href={`/${access.ctx.orgSlug}/knowledge`}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-fit")}
      >
        All knowledge
      </Link>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{doc.type}</Badge>
          <Badge variant="outline">{doc.scope}</Badge>
          <Badge variant="outline">{doc.priority}</Badge>
        </div>
        <h2 className="text-2xl font-medium tracking-tight">{doc.title}</h2>
        <p className="text-sm text-muted-foreground">
          {doc.owner} · {doc.status}
          {doc.effectiveFrom ? ` · from ${doc.effectiveFrom}` : ""}
        </p>
      </div>
      <MarkdownBody source={doc.body} />
    </article>
  );
}
