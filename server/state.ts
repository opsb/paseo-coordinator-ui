import { existsSync, readdirSync, readFileSync, watch, type FSWatcher } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Report } from "../shared/cards";
import { type InboxCard, openCards, parseInbox } from "../shared/inbox";
import { normaliseReport } from "../shared/report";

/**
 * The coordinator's state on this machine: `~/.local/state/coordinator/<scope>/inbox.md` holds the
 * cards, `reports/<session-id>.json` the sweep worker's report behind each one. `inbox.sh` writes
 * both under a lock, so a read mid-write sees either the old file or the new one.
 */

export function stateRoot(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.COORD_STATE_ROOT?.trim();
  return override || path.join(os.homedir(), ".local", "state", "coordinator");
}

export interface ReadCard extends InboxCard {
  report: Report | null;
}

export interface ReadScope {
  scope: string;
  cards: ReadCard[];
}

/** The report counts only while it belongs to the session's open card, as `inbox.sh report` has it. */
function readReport(root: string, scope: string, card: InboxCard): Report | null {
  try {
    const raw = JSON.parse(readFileSync(path.join(root, scope, "reports", `${card.sessionId}.json`), "utf8")) as unknown;
    if (!raw || typeof raw !== "object" || (raw as { key?: unknown }).key !== card.key) return null;
    return normaliseReport(raw);
  } catch {
    return null;
  }
}

const byScope = (a: string, b: string): number => (a === "all" ? -1 : b === "all" ? 1 : a.localeCompare(b));

/** Every scope with an inbox, `all` first, each with its open cards that wait on a person. */
export function readScopes(root: string): ReadScope[] {
  let entries: string[];
  try {
    entries = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(path.join(root, entry.name, "inbox.md")))
      .map((entry) => entry.name)
      .sort(byScope);
  } catch {
    return [];
  }
  return entries.map((scope) => {
    let markdown = "";
    try {
      markdown = readFileSync(path.join(root, scope, "inbox.md"), "utf8");
    } catch {
      // Removed between the listing and the read; an empty inbox is the truth now.
    }
    return {
      scope,
      cards: openCards(parseInbox(markdown)).map((card) => ({ ...card, report: readReport(root, scope, card) })),
    };
  });
}

const SETTLE_MS = 150;
const POLL_MS = 5_000;

/**
 * Calls `onChange` when anything under the state root may have changed. File events are the fast
 * path; a slow poll covers a root that does not exist yet and platforms whose events are patchy.
 */
export function watchState(root: string, onChange: () => void): () => void {
  let settle: ReturnType<typeof setTimeout> | null = null;
  let watcher: FSWatcher | null = null;
  const changed = () => {
    if (settle) clearTimeout(settle);
    settle = setTimeout(onChange, SETTLE_MS);
  };
  const attach = () => {
    if (watcher || !existsSync(root)) return;
    try {
      watcher = watch(root, { recursive: true }, changed);
      watcher.on("error", () => {
        watcher?.close();
        watcher = null;
      });
    } catch {
      watcher = null;
    }
  };
  attach();
  const poll = setInterval(() => {
    attach();
    onChange();
  }, POLL_MS);
  return () => {
    clearInterval(poll);
    if (settle) clearTimeout(settle);
    watcher?.close();
    watcher = null;
  };
}

export interface DeckSnapshot {
  revision: number;
  scopes: ReadScope[];
}

/**
 * The cards as last read, with a revision that moves when they change, or when something about
 * the sessions behind them has (`touch`). Panels long-poll `waitForChange`.
 */
export function createDeckStore(root: string) {
  let scopes = readScopes(root);
  let fingerprint = JSON.stringify(scopes);
  let revision = 1;
  const waiters = new Set<() => void>();

  const current = (): DeckSnapshot => ({ revision, scopes });

  function wake(): void {
    for (const waiter of [...waiters]) waiter();
  }

  function refresh(): void {
    const next = readScopes(root);
    const nextFingerprint = JSON.stringify(next);
    if (nextFingerprint === fingerprint) return;
    scopes = next;
    fingerprint = nextFingerprint;
    revision += 1;
    wake();
  }

  function touch(): void {
    revision += 1;
    wake();
  }

  /** Resolves once the revision passes `sinceRevision`, or after `timeoutMs` with whatever is current. */
  function waitForChange(sinceRevision: number, timeoutMs: number): Promise<DeckSnapshot> {
    if (revision > sinceRevision) return Promise.resolve(current());
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        waiters.delete(finish);
        resolve(current());
      };
      const timer = setTimeout(finish, timeoutMs);
      waiters.add(finish);
    });
  }

  const stop = watchState(root, refresh);

  return {
    current,
    refresh,
    touch,
    waitForChange,
    close(): void {
      stop();
      wake();
    },
  };
}

export type DeckStore = ReturnType<typeof createDeckStore>;
