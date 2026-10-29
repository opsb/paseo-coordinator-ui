import { describe, expect, it } from "vitest";
import { composeReply, primaryOptions, remindReply } from "./reply";

const card = { motif: "🔑", stream: "Google sign-in", sessionId: "aaaa", key: "aaaa@h1" };

describe("composeReply", () => {
  it("names the card on the first line and puts the reply on the second", () => {
    expect(composeReply(card, "y")).toBe("[card reply] 🔑 Google sign-in · session aaaa · card aaaa@h1\ny");
  });
  it("leaves out a missing motif and trims the reply", () => {
    expect(composeReply({ ...card, motif: "" }, "  ship it, but keep Gmail out  ")).toBe(
      "[card reply] Google sign-in · session aaaa · card aaaa@h1\nship it, but keep Gmail out",
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
