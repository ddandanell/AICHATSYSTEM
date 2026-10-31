import {
  boolean,
  customType,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
  },
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id").unique(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull().$type<"owner" | "admin" | "reviewer" | "viewer">(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const providerCredentials = pgTable("provider_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  provider: text("provider")
    .notNull()
    .$type<"openai" | "anthropic" | "azure_openai" | "bedrock" | "google">(),
  encryptedKey: bytea("encrypted_key").notNull(),
  keyHint: text("key_hint"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  rotatedAt: timestamp("rotated_at", { withTimezone: true, mode: "date" }),
});

export const rawMessages = pgTable("raw_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  conversationId: uuid("conversation_id").notNull(),
  body: text("body").notNull(),
  channel: text("channel").notNull().default("manual"),
  receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export type SourceRef = {
  id: string;
  title: string;
  kind: "position" | "playbook";
};

export type SourceMark = {
  id: string;
  mark: "cited" | "irrelevant" | "missing";
};

export const decisionRecords = pgTable("decision_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  conversationId: uuid("conversation_id").notNull(),
  inboundMessageId: uuid("inbound_message_id")
    .notNull()
    .references(() => rawMessages.id),
  draftText: text("draft_text").notNull(),
  finalText: text("final_text"),
  actionTaken: text("action_taken"),
  rationale: text("rationale"),
  whyNot: text("why_not"),
  rejectedAlternative: text("rejected_alternative"),
  reasonCode: text("reason_code"),
  confidence: numeric("confidence"),
  sourceRefs: jsonb("source_refs").notNull().$type<SourceRef[]>().default([]),
  humanDecision: text("human_decision").$type<
    "accepted" | "edited" | "rejected" | "escalated"
  >(),
  status: text("status")
    .notNull()
    .$type<"pending_review" | "reviewed">()
    .default("pending_review"),
  outcome: text("outcome").$type<
    "booked" | "closed" | "refunded" | "no_response" | "complaint" | "ongoing"
  >(),
  outcomeAt: timestamp("outcome_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const feedbackEvents = pgTable("feedback_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  decisionRecordId: uuid("decision_record_id")
    .notNull()
    .references(() => decisionRecords.id),
  actorId: uuid("actor_id").references(() => users.id),
  humanDecision: text("human_decision")
    .notNull()
    .$type<"accepted" | "edited" | "rejected" | "escalated">(),
  reasonCode: text("reason_code").notNull(),
  rationale: text("rationale"),
  whyNot: text("why_not"),
  sourceMarks: jsonb("source_marks").notNull().$type<SourceMark[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const rules = pgTable("rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  scope: text("scope").notNull(),
  statement: text("statement").notNull(),
  priority: integer("priority").notNull().default(0),
  exceptions: jsonb("exceptions").notNull().$type<unknown[]>().default([]),
  evidenceCount: integer("evidence_count").notNull().default(0),
  ownerId: uuid("owner_id").references(() => users.id),
  version: integer("version").notNull().default(1),
  status: text("status")
    .notNull()
    .$type<"candidate" | "active" | "deprecated">()
    .default("candidate"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const evalCases = pgTable("eval_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  inboundText: text("inbound_text").notNull(),
  expectedDecision: text("expected_decision"),
  expectedReasonCode: text("expected_reason_code"),
  mustInclude: text("must_include"),
  mustNotInclude: text("must_not_include"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  evalCaseId: uuid("eval_case_id")
    .notNull()
    .references(() => evalCases.id),
  passed: boolean("passed").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const aiUsageLog = pgTable("ai_usage_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  decisionRecordId: uuid("decision_record_id").references(() => decisionRecords.id),
  provider: text("provider"),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});
