/**
 * AI vs human draft diff for the desk and learning queue.
 * Purpose: strikethrough deletions, highlight additions (CBLS evidence).
 * Panes: workspace (before approve) and learning queue cards.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/cbls-architecture.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
"use client";

import { cn } from "cn";

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}

export function DiffText({
  original,
  edited,
  className,
}: {
  original: string;
  edited: string;
  className?: string;
}) {
  const left = tokenize(original);
  const right = tokenize(edited);
  const leftSet = new Set(left.filter((token) => token.trim()));
  const rightSet = new Set(right.filter((token) => token.trim()));

  return (
    <p className={cn("text-sm leading-6 whitespace-pre-wrap", className)}>
      {right.map((token, index) => {
        if (!token.trim()) return <span key={`w-${index}`}>{token}</span>;
        const added = !leftSet.has(token);
        return (
          <span
            key={`r-${index}-${token.slice(0, 12)}`}
            className={added ? "rounded-sm bg-emerald-100/80 text-emerald-950" : undefined}
          >
            {token}
          </span>
        );
      })}
      {left.some((token) => token.trim() && !rightSet.has(token)) ? (
        <>
          {" "}
          <span className="text-muted-foreground">· removed: </span>
          {left.map((token, index) => {
            if (!token.trim() || rightSet.has(token)) return null;
            return (
              <span
                key={`l-${index}-${token.slice(0, 12)}`}
                className="mr-1 text-rose-700 line-through decoration-rose-400"
              >
                {token}
              </span>
            );
          })}
        </>
      ) : null}
    </p>
  );
}
