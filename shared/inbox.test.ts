import { describe, expect, it } from "vitest";
import { openCards, parseInbox, parseInboxLine, splitMotif } from "./inbox";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const line = (box: string, head: string, key = "k1") => `- [${box}] ${head} · ${A} · 2026-10-25 18:52 <!-- ${key} -->`;

describe("parseInboxLine", () => {
  it("reads a card with a motif", () => {
    expect(parseInboxLine(line(" ", "🔑 Google sign-in · do · Run the gate sync"))).toEqual({
      key: "k1",
      sessionId: A,
      motif: "🔑",
      stream: "Google sign-in",
      kind: "do",
      ask: "Run the gate sync",
      addedAt: "2026-10-25 18:52",
      open: true,
    });
  });

  it("reads a card without a motif", () => {
    const card = parseInboxLine(line(" ", "Stream · decide · Approve proposal 2?"));
    expect(card).toMatchObject({ motif: "", stream: "Stream", kind: "decide", ask: "Approve proposal 2?" });
  });

  it("keeps a separator inside the stream and the ask", () => {
    const card = parseInboxLine(line(" ", "📱 Mobile · flags · decide · Ship now · or wait?"));
    expect(card).toMatchObject({ stream: "Mobile · flags", kind: "decide", ask: "Ship now · or wait?" });
  });

  it("marks a ticked-off card closed", () => {
    expect(parseInboxLine(line("x", "Stream · decide · Old ask"))?.open).toBe(false);
  });

  it("keeps the key with its session and hash", () => {
    expect(parseInboxLine(line(" ", "S · accept · Close?", `${A}@close@https://github.com/o/r/pull/1`))?.key).toBe(
      `${A}@close@https://github.com/o/r/pull/1`,
    );
  });

  it("ignores lines that are not cards", () => {
    expect(parseInboxLine("# Coordinator inbox")).toBeNull();
    expect(parseInboxLine("")).toBeNull();
    expect(parseInboxLine("- [ ] no session here <!-- k -->")).toBeNull();
  });
});

describe("parseInbox and openCards", () => {
  it("keeps open cards that wait on a person, in file order", () => {
    const inbox = [
      "# Coordinator inbox",
      "",
      line("x", "🔑 Sign-in · decide · Old ask", "k0"),
      line(" ", "🔑 Sign-in · decide · New ask", "k1"),
      line(" ", "🪞 Duplicates · nudge · Carry on with the merge", "k2"),
      line(" ", "📋 UAT · accept · Close this session?", "k3"),
    ].join("\n");
    expect(parseInbox(inbox)).toHaveLength(4);
    expect(openCards(parseInbox(inbox)).map((card) => card.key)).toEqual(["k1", "k3"]);
  });
});

describe("splitMotif", () => {
  it("takes a leading emoji, including a compound one", () => {
    expect(splitMotif("🧑‍🚀 Launch")).toEqual({ motif: "🧑‍🚀", stream: "Launch" });
  });
  it("leaves a plain name alone", () => {
    expect(splitMotif("Launch")).toEqual({ motif: "", stream: "Launch" });
  });
});
