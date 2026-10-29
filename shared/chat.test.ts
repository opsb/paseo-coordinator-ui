import type { AgentStreamEvent } from "@getpaseo/protocol/agent-types";
import { describe, expect, it } from "vitest";
import { applyEvent, EMPTY_THREAD, sent } from "./chat";

const answer = (text: string, messageId?: string): AgentStreamEvent => ({
  type: "timeline",
  provider: "claude",
  item: { type: "assistant_message", text, messageId },
});

describe("a card chat thread", () => {
  it("records what you sent and waits for an answer", () => {
    const thread = sent(EMPTY_THREAD, "  why this one?  ");
    expect(thread.messages).toEqual([{ id: expect.any(String), from: "you", text: "why this one?" }]);
    expect(thread.busy).toBe(true);
  });

  it("joins the pieces of a streamed answer and settles when the turn ends", () => {
    let thread = sent(EMPTY_THREAD, "why?");
    thread = applyEvent(thread, { type: "turn_started", provider: "claude" });
    thread = applyEvent(thread, answer("Because", "m1"));
    thread = applyEvent(thread, answer(" the", "m1"));
    thread = applyEvent(thread, answer(" branch.", "m1"));
    thread = applyEvent(thread, { type: "turn_completed", provider: "claude" });
    expect(thread.messages.map((m) => [m.from, m.text])).toEqual([
      ["you", "why?"],
      ["coordinator", "Because the branch."],
    ]);
    expect(thread.busy).toBe(false);
  });

  it("joins pieces without an id onto the open answer", () => {
    let thread = applyEvent(EMPTY_THREAD, answer("One"));
    thread = applyEvent(thread, answer(" two"));
    expect(thread.messages.map((m) => m.text)).toEqual(["One two"]);
  });

  it("starts a fresh answer after your next question", () => {
    let thread = applyEvent(EMPTY_THREAD, answer("First", "m1"));
    thread = sent(thread, "and?");
    thread = applyEvent(thread, answer("Second", "m2"));
    expect(thread.messages.map((m) => m.text)).toEqual(["First", "and?", "Second"]);
  });

  it("keeps separate answers apart", () => {
    let thread = applyEvent(EMPTY_THREAD, answer("First", "m1"));
    thread = applyEvent(thread, answer("Second", "m2"));
    expect(thread.messages.map((m) => m.text)).toEqual(["First", "Second"]);
  });

  it("ignores everything that is not an answer", () => {
    let thread = applyEvent(EMPTY_THREAD, { type: "timeline", provider: "claude", item: { type: "reasoning", text: "hmm" } });
    thread = applyEvent(thread, { type: "timeline", provider: "claude", item: { type: "user_message", text: "me" } });
    thread = applyEvent(thread, answer("   ", "m9"));
    expect(thread).toEqual(EMPTY_THREAD);
  });

  it("notes a failed turn and stops waiting", () => {
    const thread = applyEvent(sent(EMPTY_THREAD, "x"), { type: "turn_failed", provider: "claude", error: "boom" });
    expect(thread.busy).toBe(false);
    expect(thread.messages[1]).toMatchObject({ from: "note", text: "The coordinator's turn failed: boom" });
  });
});
