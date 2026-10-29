import { describe, expect, it } from "vitest";
import { normaliseReport } from "./report";

describe("normaliseReport", () => {
  it("settles a full report", () => {
    const report = normaliseReport({
      class: "Blocked",
      kind: "decide",
      area: "mobile",
      group: "PR #1403",
      links: [{ label: "PR #1403", url: "https://github.com/acme/app/pull/1403", state: "approved" }],
      effort_min: "2",
      release: "long",
      human_words: "check the scopes",
      since: "sign-in needs no new scopes",
      ask: "ship now?",
      recommend: "yes",
      evidence: "gh pr view: mergeable",
      rule: null,
    });
    expect(report).toMatchObject({ class: "Blocked", effortMin: 2, humanWords: "check the scopes", rule: null });
    expect(report?.links).toEqual([{ label: "PR #1403", url: "https://github.com/acme/app/pull/1403", state: "approved" }]);
  });

  it("treats none, empty and missing as nothing", () => {
    const report = normaliseReport({ evidence: "none", recommend: "", since: "N/A", effort_min: "lots" });
    expect(report).toMatchObject({ evidence: null, recommend: null, since: null, effortMin: null, ask: null });
  });

  it("drops links without a usable URL and names unlabelled ones by their URL", () => {
    const report = normaliseReport({
      links: [{ label: "guess", url: "ENG-1" }, { url: "https://linear.app/acme/issue/ENG-1" }, "junk"],
    });
    expect(report?.links).toEqual([
      { label: "https://linear.app/acme/issue/ENG-1", url: "https://linear.app/acme/issue/ENG-1", state: null },
    ]);
  });

  it("is null for anything that is not an object", () => {
    expect(normaliseReport(null)).toBeNull();
    expect(normaliseReport("[]")).toBeNull();
  });
});
