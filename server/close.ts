import { mkdirSync, readFileSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Ticks a card off in the coordinator's inbox, as `inbox.sh done` does, so the card leaves every
 * deck the moment the human answers it, not when the coordinator gets round to it. It takes the
 * scripts' own lock (the `<inbox>.lock` directory, made with mkdir) and changes one thing: the box
 * on the line whose key matches, `[ ]` to `[x]`. The report file stays for the coordinator's own
 * `inbox.sh done` to remove. A lock older than `STALE_LOCK_MS` belongs to a script that died.
 */

const LOCK_WAIT_MS = 5_000;
const LOCK_RETRY_MS = 50;
const STALE_LOCK_MS = 60_000;

export type CloseOutcome = "closed" | "already-closed" | "not-found" | "no-inbox";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withInboxLock<T>(inbox: string, work: () => T): Promise<T> {
  const lock = `${inbox}.lock`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      try {
        if (Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS) rmdirSync(lock);
      } catch {
        // The lock went away between the attempts; try again at once.
      }
      if (Date.now() > deadline) throw new Error(`the inbox is locked by another writer: ${lock}`);
      await sleep(LOCK_RETRY_MS);
    }
  }
  try {
    return work();
  } finally {
    try {
      rmdirSync(lock);
    } catch {
      // Already released.
    }
  }
}

/** The inbox text with the open card for `key` ticked off, and what that changed. */
export function tickOff(markdown: string, key: string): { markdown: string; outcome: CloseOutcome } {
  const marker = `<!-- ${key} -->`;
  const lines = markdown.split("\n");
  const found = { outcome: "not-found" as CloseOutcome };
  const next = lines.map((line) => {
    if (!line.trimEnd().endsWith(marker)) return line;
    if (line.startsWith("- [x] ")) {
      found.outcome = "already-closed";
      return line;
    }
    if (!line.startsWith("- [ ] ")) return line;
    found.outcome = "closed";
    return `- [x] ${line.slice("- [ ] ".length)}`;
  });
  return { markdown: found.outcome === "closed" ? next.join("\n") : markdown, outcome: found.outcome };
}

export async function closeCard(root: string, scope: string, key: string): Promise<CloseOutcome> {
  const inbox = path.join(root, scope, "inbox.md");
  return withInboxLock(inbox, () => {
    let markdown: string;
    try {
      markdown = readFileSync(inbox, "utf8");
    } catch {
      return "no-inbox";
    }
    const { markdown: next, outcome } = tickOff(markdown, key);
    if (outcome === "closed") writeFileSync(inbox, next);
    return outcome;
  });
}
