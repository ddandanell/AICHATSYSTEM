import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWorkspaceAccess } from "@/lib/context";
import { listKnowledge } from "@/lib/knowledge";

export const metadata = { title: "Knowledge" };

export default async function KnowledgePage({
  params,
}: PageProps<"/[workspace]/knowledge">) {
  const { workspace } = await params;
  const access = await getWorkspaceAccess(workspace);
  if (access.status !== "ok") return null;
  const docs = listKnowledge();
  const positions = docs.filter((doc) => doc.kind === "position");
  const playbooks = docs.filter((doc) => doc.kind === "playbook");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-medium tracking-tight">Knowledge</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Positions say what is true. Playbooks say how to decide. Both are
          markdown in the repo. This slice does not rewrite them from feedback.
        </p>
      </div>
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Positions</h3>
        <ul className="grid gap-3 md:grid-cols-2">
          {positions.map((doc) => (
            <li key={doc.id}>
              <Link href={`/${access.ctx.orgSlug}/knowledge/${doc.id}`} className="block">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{doc.scope}</Badge>
                      <Badge variant="outline">{doc.priority}</Badge>
                    </div>
                    <CardTitle>{doc.title}</CardTitle>
                    <CardDescription>
                      {doc.status} · {doc.owner}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Playbooks</h3>
        <ul className="grid gap-3 md:grid-cols-2">
          {playbooks.map((doc) => (
            <li key={doc.id}>
              <Link href={`/${access.ctx.orgSlug}/knowledge/${doc.id}`} className="block">
                <Card>
                  <CardHeader>
                    <Badge variant="outline">Playbook</Badge>
                    <CardTitle>{doc.title}</CardTitle>
                    <CardDescription>{doc.scope}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
