/**
 * Full-height three-pane inbox shell (queue | workspace | context).
 * Purpose: desktop desk layout; on small screens stack list → detail.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-ux.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function DeskShell({
  slug,
  ids,
  activeId,
  children,
}: {
  slug: string;
  ids: string[];
  activeId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (ids.length === 0) return;
      const index = activeId ? ids.indexOf(activeId) : -1;
      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        const next = ids[Math.min(ids.length - 1, Math.max(0, index) + 1)] ?? ids[0];
        if (next) router.push(`/${slug}/inbox/${next}`);
      }
      if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        const prev = ids[Math.max(0, (index < 0 ? 0 : index) - 1)] ?? ids[0];
        if (prev) router.push(`/${slug}/inbox/${prev}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, ids, router, slug]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="shrink-0 border-b bg-amber-50 px-4 py-2 text-xs text-amber-950">
        Sending is not connected. Reviews stay in the ledger. J/K move the queue.
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(15rem,22%)_minmax(0,78%)]">
        {children}
      </div>
    </div>
  );
}
