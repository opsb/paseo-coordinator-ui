import { describe, expect, it } from "vitest";
import { composeChat, composeReply, primaryOptions, remindReply } from "./reply";

const card = { motif: "🔑", stream: "Google sign-in", sessionId: "aaaa", key: "aaaa@h1", ask: "Ship now?" };

describe("composeReply", () => {
  it("names the card, then the ask, then the reply", () => {
    expect(composeReply(card, "y")).toBe(
      "[card reply] 🔑 Google sign-in · session aaaa · card aaaa@h1 (already ticked off in the inbox)\nAsked: Ship now?\nReply: y",
    );
  });
  it("leaves out a missing motif and trims the reply", () => {
    expect(composeReply({ ...card, motif: "" }, "  ship it, but keep Gmail out  ")).toBe(
      "[card reply] Google sign-in · session aaaa · card aaaa@h1 (already ticked off in the inbox)\nAsked: Ship now?\nReply: ship it, but keep Gmail out",
    );
  });
});

describe("primaryOptions", () => {
  it("gives each kind the words the coordinator accepts", () => {
    expect(primaryOptions("decide").map((option) => option.word)).toEqual(["y", "n"]);
    expect(primaryOptions("do").map((option) => option.word)).toEqual(["done"]);
    expect(primaryOptions("accept").map((option) => option.word)).toEqual(["y", "n"]);
    expect(primaryOptions("remind")).toEqual([]);
  });
});

describe("remindReply", () => {
  it("prefixes the time", () => {
    expect(remindReply(" tomorrow ")).toBe("remind tomorrow");
  });
});

describe("composeChat", () => {
  it("names the card, says it stays open, then the words", () => {
    const text = composeChat(
      { motif: "🔑", stream: "Google sign-in", sessionId: "s1", key: "s1@abc", ask: "Ship now?" },
      "  what does the rule mean?  ",
    );
    expect(text).toBe(
      "[card chat] 🔑 Google sign-in · session s1 · card s1@abc (still open; the deck shows your answer under it)\nwhat does the rule mean?",
    );
  });
});
