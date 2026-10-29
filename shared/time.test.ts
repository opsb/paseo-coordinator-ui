import { describe, expect, it } from "vitest";
import { addedAtLabel } from "./time";

describe("addedAtLabel", () => {
  const now = new Date(2026, 9, 25, 20, 0);
  it("shows only the time for today", () => {
    expect(addedAtLabel("2026-10-25 18:52", now)).toBe("18:52");
  });
  it("adds the day for another day", () => {
    expect(addedAtLabel("2026-10-03 09:00", now)).toBe("3 Oct 09:00");
  });
  it("passes through anything it cannot read", () => {
    expect(addedAtLabel("soon", now)).toBe("soon");
  });
});
