import type { PaseoApi } from "@getpaseo/client";
import { usePaseo } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useState } from "react";
import type { CardRef } from "../shared/reply";
import { composeChat } from "../shared/reply";
import { applyEvent, EMPTY_THREAD, noted, sent, type Thread } from "../shared/chat";

/**
 * One chat thread per card, kept here rather than in the card so it survives moving between
 * cards. Opening a thread subscribes to the coordinator's live timeline; closing it lets go. The
 * coordinator is one session for the whole scope, so while a thread is open its answers show there.
 */

interface Entry {
  thread: Thread;
  listeners: Set<() => void>;
  unsubscribe: (() => void) | null;
}

const entries = new Map<string, Entry>();

function entryFor(key: string): Entry {
  let entry = entries.get(key);
  if (!entry) {
    entry = { thread: EMPTY_THREAD, listeners: new Set(), unsubscribe: null };
    entries.set(key, entry);
  }
  return entry;
}

function update(entry: Entry, next: Thread): void {
  entry.thread = next;
  for (const listener of [...entry.listeners]) listener();
}

function follow(entry: Entry, paseo: PaseoApi, agentId: string): void {
  if (entry.unsubscribe) return;
  const unsubscribe = paseo.agents.ref(agentId).timeline.subscribe(({ event }) => {
    if ("type" in event && event.type === "error") {
      update(entry, noted(entry.thread, `Lost the coordinator's chat: ${event.error}`));
      return;
    }
    update(entry, applyEvent(entry.thread, event as Parameters<typeof applyEvent>[1]));
  });
  entry.unsubscribe = () => void unsubscribe();
}

export function isOpen(key: string): boolean {
  return entries.get(key)?.unsubscribe !== null && entries.has(key);
}

export function closeThread(key: string): void {
  const entry = entries.get(key);
  if (!entry) return;
  entry.unsubscribe?.();
  entry.unsubscribe = null;
  update(entry, EMPTY_THREAD);
}

/** The thread for one card: its messages, whether it is open, and the ways to speak into it. */
export function useThread(card: CardRef, agentId: string | null) {
  const paseo = usePaseo();
  const key = card.key;
  const [, bump] = useState(0);

  useEffect(() => {
    const entry = entryFor(key);
    const listener = () => bump((n) => n + 1);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
    };
  }, [key]);

  const open = useCallback(() => {
    if (!agentId) return;
    const entry = entryFor(key);
    follow(entry, paseo, agentId);
    update(entry, entry.thread);
  }, [paseo, key, agentId]);

  const close = useCallback(() => closeThread(key), [key]);

  const send = useCallback(
    async (text: string) => {
      if (!agentId || !text.trim()) return;
      const entry = entryFor(key);
      follow(entry, paseo, agentId);
      update(entry, sent(entry.thread, text));
      try {
        await paseo.agents.ref(agentId).send(composeChat(card, text), { activeTurnBehavior: "steer" });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        update(entry, { ...noted(entry.thread, `Could not reach the coordinator: ${reason}`), busy: false });
      }
    },
    [paseo, key, agentId, card],
  );

  const entry = entries.get(key);
  return { thread: entry?.thread ?? EMPTY_THREAD, isOpen: entry?.unsubscribe != null, open, close, send };
}
