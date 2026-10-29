/**
 * What a card accepts, and the message the deck sends the coordinator. The coordinator reads
 * replies from its chat (y, n, done, park, remind <when>, skip, refresher, more, or the human's own
 * words), so the deck sends those same words, headed by which card they answer: the coordinator
 * may have a different card in front of it in the chat.
 */

export interface ReplyOption {
  /** The reply the coordinator accepts. */
  word: string;
  label: string;
  /** Shown beside the label when the word alone would not say what happens. */
  hint?: string;
}

const PRIMARY: Record<string, ReplyOption[]> = {
  decide: [
    { word: "y", label: "Yes" },
    { word: "n", label: "No" },
  ],
  do: [{ word: "done", label: "Done", hint: "I did what it asks" }],
  accept: [
    { word: "y", label: "Accept", hint: "and close the session" },
    { word: "n", label: "Not yet", hint: "say what next" },
  ],
};

/** The one-word replies that answer a card of this kind. */
export function primaryOptions(kind: string): ReplyOption[] {
  return PRIMARY[kind] ?? [];
}

/** Replies every card accepts, which move it rather than answer it. */
export const DEFER_OPTIONS: readonly ReplyOption[] = [
  { word: "park", label: "Park", hint: "back 09:00 next working day" },
  { word: "skip", label: "Skip", hint: "to the end of the queue" },
];

/** Replies the coordinator answers in its chat, so the deck opens the chat after sending them. */
export const CHAT_OPTIONS: readonly ReplyOption[] = [
  { word: "refresher", label: "Refresher", hint: "what this stream is about" },
  { word: "more", label: "More", hint: "the session's last message in full" },
];

export function remindReply(when: string): string {
  return `remind ${when.trim()}`;
}

export interface CardRef {
  motif: string;
  stream: string;
  sessionId: string;
  key: string;
}

export const REPLY_HEADER = "[card reply]";

/** One message, the card first and the reply on its own line, so the coordinator closes the right card. */
export function composeReply(card: CardRef, reply: string): string {
  const name = card.motif ? `${card.motif} ${card.stream}` : card.stream;
  return `${REPLY_HEADER} ${name} · session ${card.sessionId} · card ${card.key}\n${reply.trim()}`;
}
