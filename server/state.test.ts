import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDeckStore, readScopes, stateRoot } from "./state";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const line = (head: string, id: string, key: string, box = " ") =>
  `- [${box}] ${head} · ${id} · 2026-10-25 18:52 <!-- ${key} -->`;

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "coord-ui-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeScope(scope: string, lines: string[], reports: Record<string, unknown> = {}) {
  mkdirSync(path.join(root, scope, "reports"), { recursive: true });
  writeFileSync(path.join(root, scope, "inbox.md"), ["# Coordinator inbox", "", ...lines, ""].join("\n"));
  for (const [id, report] of Object.entries(reports)) {
    writeFileSync(path.join(root, scope, "reports", `${id}.json`), JSON.stringify(report));
  }
}

describe("stateRoot", () => {
  it("prefers COORD_STATE_ROOT and falls back to the coordinator's default", () => {
    expect(stateRoot({ COORD_STATE_ROOT: "/tmp/x" })).toBe("/tmp/x");
    expect(stateRoot({})).toBe(path.join(os.homedir(), ".local", "state", "coordinator"));
  });
});

describe("readScopes", () => {
  it("is empty when the root does not exist", () => {
    expect(readScopes(path.join(root, "missing"))).toEqual([]);
  });

  it("reads every scope with an inbox, all first, with open cards and their current reports", () => {
    writeScope("proj-1", [line("📋 UAT · accept · Close this session?", B, `${B}@h9`)]);
    writeScope(
      "all",
      [
        line("🔑 Sign-in · decide · Old ask", A, `${A}@h1`, "x"),
        line("🔑 Sign-in · decide · Ship now?", A, `${A}@h2`),
        line("🪞 Duplicates · nudge · Carry on", B, `${B}@h3`),
      ],
      { [A]: { key: `${A}@h2`, class: "Blocked", recommend: "yes", links: [] }, [B]: { key: "stale", class: "Stuck" } },
    );
    mkdirSync(path.join(root, "not-a-scope"));

    const scopes = readScopes(root);
    expect(scopes.map((scope) => scope.scope)).toEqual(["all", "proj-1"]);
    expect(scopes[0].cards.map((card) => card.key)).toEqual([`${A}@h2`]);
    expect(scopes[0].cards[0].report).toMatchObject({ class: "Blocked", recommend: "yes" });
    expect(scopes[1].cards[0].report).toBeNull();
  });

  it("drops a report whose key no longer matches the open card", () => {
    writeScope("all", [line("S · decide · New?", A, `${A}@h2`)], { [A]: { key: `${A}@h1`, class: "Blocked" } });
    expect(readScopes(root)[0].cards[0].report).toBeNull();
  });
});

describe("createDeckStore", () => {
  it("answers at once when the revision has moved, and moves it when the inbox changes", async () => {
    writeScope("all", [line("S · decide · First?", A, `${A}@h1`)]);
    const store = createDeckStore(root);
    try {
      const first = await store.waitForChange(0, 1_000);
      expect(first.scopes[0].cards[0].ask).toBe("First?");

      const waiting = store.waitForChange(first.revision, 5_000);
      writeScope("all", [line("S · decide · Second?", A, `${A}@h2`)]);
      store.refresh();
      const second = await waiting;
      expect(second.revision).toBeGreaterThan(first.revision);
      expect(second.scopes[0].cards[0].ask).toBe("Second?");
    } finally {
      store.close();
    }
  });

  it("returns the current snapshot after the timeout and on touch", async () => {
    const store = createDeckStore(root);
    try {
      const idle = await store.waitForChange(1, 20);
      expect(idle.revision).toBe(1);
      const waiting = store.waitForChange(1, 5_000);
      store.touch();
      expect((await waiting).revision).toBe(2);
    } finally {
      store.close();
    }
  });
});
