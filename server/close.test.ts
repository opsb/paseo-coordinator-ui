import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeCard, tickOff } from "./close";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const line = (box: string, key: string, ask = "Ship?") => `- [${box}] 🔑 Sign-in · decide · ${ask} · ${A} · 2026-10-25 18:52 <!-- ${key} -->`;
const inbox = (...lines: string[]) => ["# Coordinator inbox", "", ...lines, ""].join("\n");

describe("tickOff", () => {
  it("flips only the open line whose key matches", () => {
    const before = inbox(line(" ", `${A}@h1`, "Old?"), line(" ", `${A}@h2`), line(" ", "other@h1"));
    const { markdown, outcome } = tickOff(before, `${A}@h2`);
    expect(outcome).toBe("closed");
    expect(markdown).toBe(inbox(line(" ", `${A}@h1`, "Old?"), line("x", `${A}@h2`), line(" ", "other@h1")));
  });

  it("does not mistake a key that ends the same way", () => {
    const before = inbox(line(" ", `${A}@h12`));
    expect(tickOff(before, `${A}@h1`).outcome).toBe("not-found");
  });

  it("reports an already ticked card and leaves the text alone", () => {
    const before = inbox(line("x", `${A}@h1`));
    expect(tickOff(before, `${A}@h1`)).toEqual({ markdown: before, outcome: "already-closed" });
  });
});

describe("closeCard", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "coord-close-"));
    mkdirSync(path.join(root, "all"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("writes the ticked inbox and releases the lock", async () => {
    const file = path.join(root, "all", "inbox.md");
    writeFileSync(file, inbox(line(" ", `${A}@h1`)));
    expect(await closeCard(root, "all", `${A}@h1`)).toBe("closed");
    expect(readFileSync(file, "utf8")).toBe(inbox(line("x", `${A}@h1`)));
    expect(() => mkdirSync(`${file}.lock`)).not.toThrow();
  });

  it("says when there is no inbox", async () => {
    expect(await closeCard(root, "all", "k")).toBe("no-inbox");
  });

  it("waits for a live lock and takes a stale one", async () => {
    const file = path.join(root, "all", "inbox.md");
    writeFileSync(file, inbox(line(" ", `${A}@h1`)));
    const lock = `${file}.lock`;
    mkdirSync(lock);
    const closing = closeCard(root, "all", `${A}@h1`);
    await new Promise((resolve) => setTimeout(resolve, 120));
    rmSync(lock, { recursive: true });
    expect(await closing).toBe("closed");

    mkdirSync(lock);
    const old = new Date(Date.now() - 120_000);
    utimesSync(lock, old, old);
    writeFileSync(file, inbox(line(" ", `${A}@h2`)));
    expect(await closeCard(root, "all", `${A}@h2`)).toBe("closed");
  });
});
