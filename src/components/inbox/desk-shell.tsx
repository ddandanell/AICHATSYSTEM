/**
 * Full-height three-pane inbox shell (queue | workbench | context).
 * Purpose: desktop Intercom/Front desk; mobile stacks list → detail.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-design-system.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-ux.md
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";

export function DeskShell({
  slug,
  ids,
  activeId,
  queue,
  children,
}: {
  slug: string;
  ids: string[];
  activeId: string | null;
  queue: React.ReactNode;
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
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        className={cn(
          "flex min-h-0 w-full shrink-0 flex-col border-border lg:w-80 lg:border-r",
          activeId ? "hidden lg:flex" : "flex",
        )}
      >
        {queue}
      </div>
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col bg-background",
          !activeId ? "hidden lg:flex" : "flex",
        )}
      >
        {children}
      </div>
    </div>
  );
}
