/**
 * Workspace content chrome: constrained pages vs full-bleed inbox desk.
 * Purpose: inbox uses three panes edge-to-edge; other console pages stay max-width.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-ux.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
"use client";

import { usePathname } from "next/navigation";

export function WorkspaceMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const desk = /\/[^/]+\/inbox(\/|$)/.test(pathname);
  if (desk) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        {children}
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 md:px-6">
      {children}
    </div>
  );
}
