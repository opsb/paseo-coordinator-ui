import { useRpc } from "@getpaseo/plugin/client";
import { useEffect, useReducer } from "react";
import { type Deck, watchDeck } from "../shared/cards";

/**
 * Long-polls the daemon for the deck, so a card appears the moment the inbox worker adds it and
 * leaves the moment the coordinator ticks it off. One poll per host, shared by the sidebar badge
 * and the screen; it runs while either is mounted.
 */

type Watch = (input: { sinceRevision: number }) => Promise<Deck>;

interface HostDeck {
  deck: Deck | null;
  error: string | null;
  watch: Watch;
  listeners: Set<() => void>;
  stop: (() => void) | null;
}

const hosts = new Map<string, HostDeck>();
const RETRY_MS = 3_000;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function notify(entry: HostDeck): void {
  for (const listener of [...entry.listeners]) listener();
}

function start(entry: HostDeck): () => void {
  let active = true;
  (async () => {
    let sinceRevision = 0;
    while (active) {
      try {
        const next = await entry.watch({ sinceRevision });
        if (!active) return;
        sinceRevision = next.revision;
        entry.deck = next;
        entry.error = null;
        notify(entry);
      } catch (error) {
        if (!active) return;
        // A reloaded daemon starts its revisions again; asking from 0 answers at once.
        sinceRevision = 0;
        entry.error = error instanceof Error ? error.message : String(error);
        notify(entry);
        await pause(RETRY_MS);
      }
    }
  })();
  return () => {
    active = false;
  };
}

export interface DeckState {
  deck: Deck | null;
  error: string | null;
}

export function useDeck(hostId: string): DeckState {
  const watch = useRpc(watchDeck);
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  let entry = hosts.get(hostId);
  if (!entry) {
    entry = { deck: null, error: null, watch, listeners: new Set(), stop: null };
    hosts.set(hostId, entry);
  }
  entry.watch = watch;

  useEffect(() => {
    const shared = hosts.get(hostId);
    if (!shared) return;
    shared.listeners.add(rerender);
    if (!shared.stop) shared.stop = start(shared);
    return () => {
      shared.listeners.delete(rerender);
      if (shared.listeners.size === 0) {
        shared.stop?.();
        shared.stop = null;
      }
    };
  }, [hostId]);

  return { deck: entry.deck, error: entry.error };
}

/** Every card in the deck, scope by scope, each in the order it arrived. */
export function flattenDeck(deck: Deck | null): DeckEntry[] {
  if (!deck) return [];
  return deck.scopes.flatMap((scope) => scope.cards.map((card) => ({ card, scope })));
}

export interface DeckEntry {
  card: Deck["scopes"][number]["cards"][number];
  scope: Deck["scopes"][number];
}

export function openCount(deck: Deck | null): number {
  return flattenDeck(deck).length;
}
