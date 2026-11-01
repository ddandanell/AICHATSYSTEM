/**
 * Panes 2–3 workbench: thread + AI draft + Client Info / AI Brain.
 * IMC-33 slots: TimeStrip, always-on suggestion, How it came to this, correct→learn.
 * Pane shell widths/restyle owned by inbox-design-system — keep feature hooks only.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/contact-response-desk.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-ux.md
 *        /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md
 */
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  draftConversationAction,
  reviewConversationAction,
  updateTagsAction,
} from "@/app/[workspace]/inbox/mychef-actions";
import { CategoryBadge } from "@/components/inbox/category-badge";
import { DiffText } from "@/components/inbox/diff-text";
import { TimeStrip } from "@/components/inbox/time-strip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryTagId } from "@/lib/contact-tags";
import { channelLabel } from "@/lib/channels";
import { formatConfidence, formatWhen } from "@/lib/format";
import { REASON_CODES } from "@/lib/reason-codes";
import type { ThreadTiming } from "@/lib/thread-timing";
import { cn } from "cn";

export type DeskConversation = {
  id: string;
  contact_name: string | null;
  status: string;
  channel: string | null;
  tags: string[];
  categories: CategoryTagId[];
  facts: {
    phone?: string;
    email?: string;
    address?: string;
  };
  messages: { id: string; direction: string; body: string; created_at: Date | string }[];
  draft: {
    body: string;
    model: string | null;
    sources: { id: string; title: string; kind?: string }[];
    confidence: number | null;
    why: string;
    whyNot: string;
    escalate?: boolean;
  } | null;
};

export function DeskReview({
  slug,
  conversation,
  nextId,
  knowledgeTitles,
  timing,
  draftError,
}: {
  slug: string;
  conversation: DeskConversation;
  nextId: string | null;
  knowledgeTitles: Record<string, string>;
  timing: ThreadTiming | null;
  draftError?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draftText, setDraftText] = useState(conversation.draft?.body ?? "");
  const [editing, setEditing] = useState(false);
  const [brainTab, setBrainTab] = useState<"client" | "brain">("brain");
  const [reasonCode, setReasonCode] = useState("good_as_drafted");
  const [rationale, setRationale] = useState("");
  const [whyNot, setWhyNot] = useState("");
  const [remember, setRemember] = useState(true);
  const [tagDraft, setTagDraft] = useState(conversation.tags.join(", "));
  const [updatingTags, setUpdatingTags] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState<string | null>(null);

  useEffect(() => {
    setDraftText(conversation.draft?.body ?? "");
    setEditing(false);
    setBrainTab("brain");
    setReasonCode("good_as_drafted");
    setRationale("");
    setWhyNot("");
    setRemember(true);
    setTagDraft(conversation.tags.join(", "));
    setError(null);
  }, [conversation.id, conversation.draft?.body, conversation.tags]);

  const dirty = useMemo(
    () => Boolean(conversation.draft && draftText.trim() !== conversation.draft.body.trim()),
    [conversation.draft, draftText],
  );

  useEffect(() => {
    if (dirty && editing) setBrainTab("brain");
  }, [dirty, editing]);

  function goNext() {
    if (nextId) router.push(`/${slug}/inbox/${nextId}`);
    else router.push(`/${slug}/inbox`);
  }

  function submit(decision: "accepted" | "edited" | "escalated") {
    startTransition(async () => {
      setError(null);
      const form = new FormData();
      const human =
        decision === "accepted" && dirty
          ? "edited"
          : decision === "accepted"
            ? "accepted"
            : decision;
      form.set("human_decision", human);
      form.set("final_text", human === "escalated" ? conversation.draft?.body ?? "" : draftText);
      form.set(
        "reason_code",
        human === "accepted" ? "good_as_drafted" : reasonCode || "needs_human",
      );
      form.set(
        "rationale",
        human === "accepted"
          ? "Accepted the draft as written."
          : rationale.trim() || (human === "escalated" ? "Escalated to a human." : "Edited before recording."),
      );
      form.set(
        "why_not",
        human === "accepted"
          ? "No alternative was needed."
          : whyNot.trim() || (human === "escalated" ? "A person should take this." : "The draft needed a correction."),
      );
      if (remember && human === "edited") form.set("remember", "on");
      const result = await reviewConversationAction(conversation.id, null, form);
      if (result?.error) {
        setError(result.error);
        return;
      }
      goNext();
    });
  }

  function regenerate() {
    startTransition(async () => {
      setError(null);
      await draftConversationAction(conversation.id);
      router.refresh();
    });
  }

  function saveTags() {
    startTransition(async () => {
      setUpdatingTags(true);
      setError(null);
      const tags = tagDraft
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const result = await updateTagsAction(conversation.id, tags);
      setUpdatingTags(false);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        submit(dirty ? "edited" : "accepted");
        return;
      }
      if (typing) return;
      if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        submit(dirty ? "edited" : "accepted");
      }
      if (event.key === "e" || event.key === "E") {
        event.preventDefault();
        setEditing(true);
        setBrainTab("brain");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function openHowItCame() {
    setBrainTab("brain");
  }

  function startCorrection() {
    setEditing(true);
    setBrainTab("brain");
    if (reasonCode === "good_as_drafted") setReasonCode("too_casual");
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.9fr)]">
      <section className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-medium">{conversation.contact_name ?? "Contact"}</h2>
          <Badge variant="outline">{conversation.status}</Badge>
          <Badge variant="secondary">{channelLabel(conversation.channel)}</Badge>
          {conversation.categories.map((id) => (
            <CategoryBadge key={id} id={id} />
          ))}
        </header>
        {timing ? <TimeStrip timing={timing} /> : null}
        <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
          {conversation.messages.map((message) => {
            const inbound = message.direction === "inbound";
            return (
              <li
                key={message.id}
                className={cn(
                  "max-w-[92%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  inbound
                    ? "self-start border border-transparent bg-muted/70 text-foreground"
                    : "self-end border bg-background",
                )}
              >
                <p className="mb-1 text-xs text-muted-foreground">
                  {inbound ? "Customer" : "myCHEF"} · {formatWhen(message.created_at)}
                </p>
                {message.body}
              </li>
            );
          })}
        </ol>
        <div className="sticky bottom-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          <Alert className="mb-3">
            <AlertTitle>Sending is not connected</AlertTitle>
            <AlertDescription>
              Approve records the decision in the ledger. No channel sends from this desk yet.
            </AlertDescription>
          </Alert>
          {draftError ? (
            <Alert variant="destructive" className="mb-3">
              <AlertTitle>Draft could not be generated</AlertTitle>
              <AlertDescription>{draftError}</AlertDescription>
            </Alert>
          ) : null}
          {conversation.draft ? (
            <Card className="gap-0 border-primary/20 py-0 ring-1 ring-primary/10">
              <CardHeader className="border-b border-border/60 [.border-b]:pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm">AI suggested reply</CardTitle>
                  {conversation.draft.confidence != null ? (
                    <Badge variant="secondary">
                      {formatConfidence(conversation.draft.confidence)} confidence
                    </Badge>
                  ) : null}
                  {conversation.draft.escalate ? <Badge variant="outline">Escalate flagged</Badge> : null}
                  {conversation.draft.sources[0] ? (
                    <Badge variant="outline">
                      Based on{" "}
                      {knowledgeTitles[conversation.draft.sources[0].id] ??
                        conversation.draft.sources[0].title}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 py-3">
                <Textarea
                  value={draftText}
                  onChange={(event) => {
                    setDraftText(event.target.value);
                    setEditing(true);
                    setBrainTab("brain");
                    if (event.target.value.trim() !== conversation.draft?.body.trim()) {
                      setReasonCode((prev) => (prev === "good_as_drafted" ? "too_casual" : prev));
                    }
                  }}
                  rows={7}
                  className={cn(
                    "min-h-36 bg-background",
                    editing || dirty ? "border-primary ring-1 ring-primary/20" : "border-border",
                  )}
                />
                {dirty ? (
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Diff before record</p>
                    <DiffText original={conversation.draft.body} edited={draftText} />
                  </div>
                ) : null}
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button type="button" disabled={pending} onClick={() => submit(dirty ? "edited" : "accepted")}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  Approve
                </Button>
                <Button type="button" variant="outline" disabled={pending} onClick={regenerate}>
                  Regenerate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setReasonCode("needs_human");
                    setRationale("Escalated to a human.");
                    setWhyNot("A person should take this.");
                    submit("escalated");
                  }}
                >
                  Escalate
                </Button>
                <Button type="button" variant="outline" onClick={openHowItCame}>
                  How it came to this
                </Button>
                <Button type="button" variant="ghost" onClick={startCorrection}>
                  Suggest how it should be
                </Button>
                <p className="self-center text-xs text-muted-foreground">A approve · E edit · ⌘ Enter</p>
              </CardFooter>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              <Alert>
                <AlertTitle>No AI suggestion yet</AlertTitle>
                <AlertDescription>
                  Generation failed or is still empty. Regenerate to load a draft — the middle pane must not stay blank.
                </AlertDescription>
              </Alert>
              <Button type="button" disabled={pending} onClick={regenerate} className="w-fit">
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Regenerate
              </Button>
            </div>
          )}
          {error ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col bg-muted/20">
        <div className="flex gap-1 border-b px-3 py-2">
          <button
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1 text-sm",
              brainTab === "client" ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
            )}
            onClick={() => setBrainTab("client")}
          >
            Client Info
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1 text-sm",
              brainTab === "brain" ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
            )}
            onClick={() => setBrainTab("brain")}
          >
            Why
          </button>
        </div>
        {brainTab === "client" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{conversation.facts.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{conversation.facts.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Address</dt>
                <dd className="whitespace-pre-wrap">{conversation.facts.address || "—"}</dd>
              </div>
              <div>
                <dt className="mb-2 text-muted-foreground">Tags</dt>
                <dd className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1">
                    {conversation.categories.map((id) => (
                      <CategoryBadge key={id} id={id} />
                    ))}
                    {conversation.tags.length === 0 ? (
                      <span className="text-muted-foreground">No tags yet. Try Catering or Private Chef.</span>
                    ) : (
                      conversation.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))
                    )}
                  </div>
                  <label className="text-xs text-muted-foreground" htmlFor="tags">
                    Comma-separated. Saving refreshes knowledge and regenerates the draft.
                  </label>
                  <input
                    id="tags"
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    placeholder="Private Chef, Catering, VIP"
                  />
                  <Button type="button" size="sm" variant="outline" disabled={pending} onClick={saveTags}>
                    {updatingTags ? "Updating AI knowledge…" : "Save tags & re-draft"}
                  </Button>
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <h3 className="mb-2 font-medium">How it came to this</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Sources and reasoning for the current AI suggestion. Nothing is sent from here.
                </p>
                <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Sources used
                </h4>
                {(conversation.draft?.sources.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground">No sources cited yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {conversation.draft?.sources.map((source) => (
                      <li key={source.id}>
                        <button
                          type="button"
                          className="text-left text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                          onClick={() => setSourceOpen((prev) => (prev === source.id ? null : source.id))}
                        >
                          {knowledgeTitles[source.id] ?? source.title}
                        </button>
                        {sourceOpen === source.id ? (
                          <p className="mt-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                            Full rule lives on Knowledge. Id: {source.id}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Reasoning
                </h4>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {conversation.draft?.why || "Draft a reply to see why the model chose this text."}
                </p>
                {conversation.draft?.whyNot ? (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                    Why not: {conversation.draft.whyNot}
                  </p>
                ) : null}
              </div>
              {editing || dirty ? (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <h3 className="font-medium">Correct → learn</h3>
                  <p className="text-xs text-muted-foreground">
                    Save with Remember to queue a pending situational case. Learning Queue approves later. Not auto-activated.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {REASON_CODES.filter((item) => item.code !== "good_as_drafted").map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setReasonCode(item.code)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs",
                          reasonCode === item.code
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background",
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={rationale}
                    onChange={(event) => setRationale(event.target.value)}
                    rows={3}
                    placeholder="Why this reply"
                  />
                  <Textarea
                    value={whyNot}
                    onChange={(event) => setWhyNot(event.target.value)}
                    rows={2}
                    placeholder="Why not the AI draft"
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                    />
                    Remember this for next time (pending situational case)
                  </label>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Edit the draft to open the feedback form. Or press E.
                </p>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
