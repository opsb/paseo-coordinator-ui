import type { AgentStreamEvent } from "@getpaseo/protocol/agent-types";

/**
 * A chat about one card, kept under the card. The human's words are added as they are sent; the
 * coordinator's come from its live timeline, where an answer streams as pieces of one assistant
 * message, each carrying the message's id. Nothing from before the thread opened belongs to it.
 */

export interface ChatMessage {
  id: string;
  from: "you" | "coordinator" | "note";
  text: string;
}

export interface Thread {
  messages: ChatMessage[];
  /** The coordinator is working on a turn, so an answer is on its way. */
  busy: boolean;
}

export const EMPTY_THREAD: Thread = { messages: [], busy: false };

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

export function sent(thread: Thread, text: string): Thread {
  return { messages: [...thread.messages, { id: nextId("you"), from: "you", text: text.trim() }], busy: true };
}

export function noted(thread: Thread, text: string): Thread {
  return { ...thread, messages: [...thread.messages, { id: nextId("note"), from: "note", text }] };
}

/** A piece of an answer joins the message it belongs to; a piece of a new message starts one. */
function answered(thread: Thread, piece: string, messageId: string | undefined): Thread {
  const last = thread.messages[thread.messages.length - 1];
  const continues = last?.from === "coordinator" && (messageId === undefined || last.id === messageId);
  if (continues) {
    const grown = { ...last, text: last.text + piece };
    return { ...thread, messages: [...thread.messages.slice(0, -1), grown] };
  }
  if (!piece.trim()) return thread;
  const message: ChatMessage = { id: messageId ?? nextId("coordinator"), from: "coordinator", text: piece };
  return { ...thread, messages: [...thread.messages, message] };
}

/** Folds one event from the coordinator's timeline into the thread. */
export function applyEvent(thread: Thread, event: AgentStreamEvent): Thread {
  switch (event.type) {
    case "turn_started":
      return { ...thread, busy: true };
    case "turn_completed":
    case "turn_canceled":
      return { ...thread, busy: false };
    case "turn_failed":
      return { ...noted(thread, `The coordinator's turn failed: ${event.error}`), busy: false };
    case "timeline": {
      const item = event.item;
      if (item.type !== "assistant_message") return thread;
      return answered(thread, item.text, item.messageId);
    }
    default:
      return thread;
  }
}
