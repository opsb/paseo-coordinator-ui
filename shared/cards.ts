import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

/**
 * The shapes the daemon sends the deck. A card is one open line of the coordinator's inbox
 * (`~/.local/state/coordinator/<scope>/inbox.md`), with the sweep worker's report behind it when
 * the inbox still holds one, and what Paseo knows about the session it concerns.
 */

/** The kinds the coordinator writes. A `nudge` is for the coordinator, never the human. */
export const CARD_KINDS = ["decide", "do", "accept", "remind", "nudge"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export const LinkSchema = z.object({
  label: z.string(),
  url: z.string(),
  state: z.string().nullable(),
});
export type Link = z.infer<typeof LinkSchema>;

export const ReportSchema = z.object({
  class: z.string().nullable(),
  kind: z.string().nullable(),
  area: z.string().nullable(),
  group: z.string().nullable(),
  links: z.array(LinkSchema),
  effortMin: z.number().nullable(),
  release: z.string().nullable(),
  humanWords: z.string().nullable(),
  since: z.string().nullable(),
  ask: z.string().nullable(),
  recommend: z.string().nullable(),
  evidence: z.string().nullable(),
  rule: z.string().nullable(),
});
export type Report = z.infer<typeof ReportSchema>;

export const SessionSchema = z.object({
  title: z.string().nullable(),
  status: z.string(),
  requiresAttention: z.boolean(),
  workspaceId: z.string().nullable(),
  workspaceName: z.string().nullable(),
  projectName: z.string().nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

export const CardSchema = z.object({
  key: z.string(),
  sessionId: z.string(),
  motif: z.string(),
  stream: z.string(),
  kind: z.string(),
  ask: z.string(),
  /** As written in the inbox: `YYYY-MM-DD HH:MM`, local time on the daemon. */
  addedAt: z.string(),
  scope: z.string(),
  report: ReportSchema.nullable(),
  session: SessionSchema.nullable(),
});
export type Card = z.infer<typeof CardSchema>;

export const CoordinatorSchema = z.object({
  agentId: z.string(),
  title: z.string().nullable(),
  status: z.string(),
  /** The coordinator's own `coord-card-open` flag: a card is in front of the human in its chat. */
  cardOpen: z.boolean(),
});
export type Coordinator = z.infer<typeof CoordinatorSchema>;

export const ScopeSchema = z.object({
  /** `all` or a Paseo projectId. */
  scope: z.string(),
  projectName: z.string().nullable(),
  /** The live session labelled `coord-role=coordinator` for this scope, if any. */
  coordinator: CoordinatorSchema.nullable(),
  cards: z.array(CardSchema),
});
export type Scope = z.infer<typeof ScopeSchema>;

export const DeckSchema = z.object({
  revision: z.number(),
  stateRoot: z.string(),
  scopes: z.array(ScopeSchema),
});
export type Deck = z.infer<typeof DeckSchema>;

/** Long-poll: answers when the revision passes `sinceRevision`, or after the daemon's timeout. */
export const watchDeck = defineRpc({
  name: "coordinator.deck.watch",
  input: z.object({ sinceRevision: z.number() }),
  output: DeckSchema,
});
