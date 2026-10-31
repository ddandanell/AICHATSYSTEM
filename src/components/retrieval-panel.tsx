import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { RetrievedItem } from "@/lib/retrieval";

function MatchList({
  items,
  emptyTitle,
  emptyDescription,
  workspace,
}: {
  items: RetrievedItem[];
  emptyTitle: string;
  emptyDescription: string;
  workspace?: string;
}) {
  if (items.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const score = `${Math.max(0, Math.round(item.score * 100))}%`;
        const title =
          item.kind === "decision" && workspace ? (
            <Link
              href={`/${workspace}/inbox/${item.sourceId}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {item.title}
            </Link>
          ) : (
            <span className="font-medium">{item.title}</span>
          );
        return (
          <li key={item.chunkId} className="flex flex-col gap-2 rounded-lg border px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {title}
              <Badge variant="outline">{item.kind}</Badge>
              <span className="text-xs text-muted-foreground">{score} match</span>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{item.excerpt}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function RetrievalPanel({
  workspace,
  decisions,
  knowledge,
}: {
  workspace: string;
  decisions: RetrievedItem[];
  knowledge: RetrievedItem[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Similar past decisions</h2>
        <p className="text-xs text-muted-foreground">
          Other decisions recorded in this workspace.
        </p>
        <MatchList
          items={decisions}
          workspace={workspace}
          emptyTitle="No similar decisions"
          emptyDescription="This workspace has no other decision close to this draft."
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Matching knowledge</h2>
        <p className="text-xs text-muted-foreground">
          Positions and playbooks ingested for this workspace.
        </p>
        <MatchList
          items={knowledge}
          emptyTitle="No matching knowledge"
          emptyDescription="Nothing in this workspace's positions or playbooks is close to this draft."
        />
      </section>
    </div>
  );
}
