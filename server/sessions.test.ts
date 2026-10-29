import type { PaseoApi } from "@getpaseo/client";
import { describe, expect, it } from "vitest";
import { describeScopes } from "./sessions";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const COORD = "cccccccc-0000-0000-0000-000000000003";

function agent(id: string, extra: Record<string, unknown> = {}) {
  return { id, title: null, status: "idle", labels: {}, workspaceId: "w1", ...extra };
}

function fakePaseo(agents: unknown[], workspaces: unknown[]): PaseoApi {
  return {
    agents: { list: async () => ({ entries: agents.map((a) => ({ agent: a })), pageInfo: { hasMore: false, nextCursor: null } }) },
    workspaces: { list: async () => ({ entries: workspaces }) },
  } as unknown as PaseoApi;
}

const card = { key: `${A}@h1`, sessionId: A, motif: "🔑", stream: "Sign-in", kind: "decide", ask: "Ship?", addedAt: "2026-10-25 18:52", open: true, report: null };

describe("describeScopes", () => {
  it("finds the coordinator for each scope and the session behind each card", async () => {
    const paseo = fakePaseo(
      [
        agent(A, { title: "Sign-in work", requiresAttention: true }),
        agent(COORD, { title: "🧭 Coordinator", status: "running", labels: { "coord-role": "coordinator", "coord-scope": "all", "coord-card-open": "yes" } }),
      ],
      [{ id: "w1", projectId: "p1", projectDisplayName: "fae-app-v1", name: "wt", title: "🔑 Sign-in" }],
    );
    const scopes = await describeScopes(paseo, [{ scope: "all", cards: [card] }]);
    expect(scopes).toHaveLength(1);
    expect(scopes[0].coordinator).toEqual({ agentId: COORD, title: "🧭 Coordinator", status: "running", cardOpen: true });
    expect(scopes[0].cards[0].session).toEqual({
      title: "Sign-in work",
      status: "idle",
      requiresAttention: true,
      workspaceId: "w1",
      workspaceName: "🔑 Sign-in",
      projectName: "fae-app-v1",
    });
  });

  it("names a project scope, leaves a gone session null, and lists a coordinator with no inbox yet", async () => {
    const paseo = fakePaseo(
      [agent(COORD, { labels: { "coord-role": "coordinator", "coord-scope": "p1" } })],
      [{ id: "w1", projectId: "p1", projectDisplayName: "fae-app-v1", name: "wt" }],
    );
    const scopes = await describeScopes(paseo, [{ scope: "all", cards: [card] }]);
    expect(scopes.map((scope) => scope.scope)).toEqual(["all", "p1"]);
    expect(scopes[0].coordinator).toBeNull();
    expect(scopes[0].cards[0].session).toBeNull();
    expect(scopes[1]).toMatchObject({ projectName: "fae-app-v1", cards: [] });
    expect(scopes[1].coordinator?.agentId).toBe(COORD);
  });
});
