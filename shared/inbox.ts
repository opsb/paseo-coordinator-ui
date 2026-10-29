import { CARD_KINDS } from "./cards";

/**
 * Reads the coordinator's inbox file. One line per card:
 *
 *   - [ ] 🔑 Google sign-in · do · Run the gate sync · <session-id> · 2026-10-25 18:52 <!-- <key> -->
 *
 * The session id and the time have fixed shapes, so the line is read from the right; the kind is
 * a known word, so a stream or an ask that itself contains ` · ` still parses.
 */

export interface InboxCard {
  key: string;
  sessionId: string;
  motif: string;
  stream: string;
  kind: string;
  ask: string;
  addedAt: string;
  open: boolean;
}

const LINE =
  /^- \[( |x)\] (.*) · ([0-9a-fA-F-]{36}) · (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) <!-- (.*?) -->\s*$/;
const SEPARATOR = " · ";
const KINDS: readonly string[] = CARD_KINDS;

/** A motif is the run of non-ASCII characters a name starts with, as the coordinator writes it. */
export function splitMotif(name: string): { motif: string; stream: string } {
  const match = /^([^\x00-\x7F]+) (.*)$/.exec(name);
  if (!match) return { motif: "", stream: name };
  return { motif: match[1], stream: match[2] };
}

export function parseInboxLine(line: string): InboxCard | null {
  const match = LINE.exec(line);
  if (!match) return null;
  const [, box, head, sessionId, addedAt, key] = match;
  const parts = head.split(SEPARATOR);
  let kindAt = parts.findIndex((part, index) => index > 0 && KINDS.includes(part));
  if (kindAt < 0) kindAt = Math.min(1, parts.length - 1);
  const { motif, stream } = splitMotif(parts.slice(0, kindAt).join(SEPARATOR));
  return {
    key,
    sessionId,
    motif,
    stream,
    kind: parts[kindAt] ?? "",
    ask: parts.slice(kindAt + 1).join(SEPARATOR),
    addedAt,
    open: box === " ",
  };
}

export function parseInbox(markdown: string): InboxCard[] {
  return markdown
    .split("\n")
    .map(parseInboxLine)
    .filter((card): card is InboxCard => card !== null);
}

/** The cards that wait on a person: open, and not a nudge, which is the coordinator's to send. */
export function openCards(cards: readonly InboxCard[]): InboxCard[] {
  return cards.filter((card) => card.open && card.kind !== "nudge");
}
