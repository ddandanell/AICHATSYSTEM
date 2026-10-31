/**
 * Pane 1 — message queue for the three-pane desk.
 * Purpose: search, filters (All / Needs Review / Auto-Sent / Escalated), queue cards
 * with name, snippet, timestamp, category badges, confidence dot.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-ux.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
import Link from "next/link";
import { CategoryBadge, ConfidenceDot } from "@/components/inbox/category-badge";
import type { DeskFilter, DeskQueueItem } from "@/data/mychef-store";
import { excerpt, formatWhen } from "@/lib/format";
import { cn } from "cn";

const FILTERS: { id: DeskFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_review", label: "Needs Review" },
  { id: "auto_sent", label: "Auto-Sent" },
  { id: "escalated", label: "Escalated" },
];

export function QueuePane({
  slug,
  filter,
  search,
  rows,
  activeId,
  total,
  page,
  pageSize,
}: {
  slug: string;
  filter: DeskFilter;
  search: string;
  rows: DeskQueueItem[];
  activeId: string | null;
  total: number;
  page: number;
  pageSize: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function hrefFor(next: { filter?: DeskFilter; q?: string; page?: number; id?: string | null }) {
    const params = new URLSearchParams();
    const f = next.filter ?? filter;
    if (f !== "needs_review") params.set("filter", f);
    const q = next.q ?? search;
    if (q) params.set("q", q);
    if ((next.page ?? page) > 1) params.set("page", String(next.page ?? page));
    const query = params.toString();
    const base = next.id ? `/${slug}/inbox/${next.id}` : `/${slug}/inbox`;
    return query ? `${base}?${query}` : base;
  }

  return (
    <aside className="flex min-h-0 flex-col border-b bg-muted/15 lg:border-b-0 lg:border-r">
      <div className="flex flex-col gap-3 border-b px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-tight">Queue</h2>
          <span className="text-xs text-muted-foreground">{total}</span>
        </div>
        <form className="flex gap-2" action={`/${slug}/inbox`}>
          {filter !== "needs_review" ? <input type="hidden" name="filter" value={filter} /> : null}
          <input
            name="q"
            defaultValue={search}
            placeholder="Search contacts"
            className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-sm"
          />
          <button type="submit" className="h-8 rounded-md border px-2.5 text-xs">
            Search
          </button>
        </form>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <Link
              key={item.id}
              href={hrefFor({ filter: item.id, page: 1, id: null })}
              className={cn(
                "rounded-md px-2 py-1 text-xs",
                filter === item.id
                  ? "bg-foreground text-background"
                  : "border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <li className="px-3 py-8 text-sm text-muted-foreground">
            Nothing in this filter. Automatic sending stays off.
          </li>
        ) : (
          rows.map((row) => {
            const active = row.id === activeId;
            const href =
              row.kind === "decision"
                ? `/${slug}/inbox/${row.id}?filter=${filter}${search ? `&q=${encodeURIComponent(search)}` : ""}`
                : hrefFor({ id: row.id });
            return (
              <li key={row.id}>
                <Link
                  href={href}
                  data-desk-id={row.id}
                  className={cn(
                    "block border-b border-transparent px-3 py-3 transition-colors",
                    active
                      ? "border-l-2 border-l-foreground bg-background"
                      : "border-l-2 border-l-transparent hover:bg-background/70",
                  )}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className={cn("truncate text-sm", row.unread ? "font-semibold" : "font-medium")}>
                      {row.name ?? "Contact"}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <ConfidenceDot confidence={row.confidence} />
                      <span className="text-[11px] text-muted-foreground">{formatWhen(row.when)}</span>
                    </div>
                  </div>
                  <p className="mb-2 line-clamp-1 text-xs text-muted-foreground">
                    {excerpt(row.snippet || "No inbound text", 90)}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {row.categories.map((id) => (
                      <CategoryBadge key={id} id={id} />
                    ))}
                  </div>
                </Link>
              </li>
            );
          })
        )}
      </ul>
      {pages > 1 ? (
        <nav className="flex flex-wrap gap-1 border-t px-3 py-2">
          {Array.from({ length: Math.min(pages, 8) }, (_, index) => index + 1).map((number) => (
            <Link
              key={number}
              href={hrefFor({ page: number, id: activeId })}
              className={cn(
                "rounded px-2 py-0.5 text-xs",
                number === page ? "bg-foreground text-background" : "border",
              )}
            >
              {number}
            </Link>
          ))}
        </nav>
      ) : null}
    </aside>
  );
}
