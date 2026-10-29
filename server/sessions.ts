import type { PaseoAgent, PaseoApi, PaseoWorkspace } from "@getpaseo/client";
import type { Card, Coordinator, Scope, Session } from "../shared/cards";
import type { ReadScope } from "./state";

/**
 * What Paseo knows about the sessions behind the cards: the coordinator for each scope (the live
 * session labelled `coord-role=coordinator`), and each card's session, workspace and project.
 */

const COORDINATOR_ROLE = "coordinator";

async function liveAgents(paseo: PaseoApi): Promise<PaseoAgent[]> {
  const agents: PaseoAgent[] = [];
  let cursor: string | null | undefined;
  do {
    const page = await paseo.agents.list({
      filter: { includeArchived: false },
      ...(cursor ? { cursor } : {}),
    });
    agents.push(...page.entries.map((entry) => entry.agent));
    cursor = page.pageInfo.hasMore ? page.pageInfo.nextCursor : null;
  } while (cursor);
  return agents;
}

async function workspaces(paseo: PaseoApi): Promise<PaseoWorkspace[]> {
  const result = await paseo.workspaces.list();
  return result.entries;
}

function coordinatorOf(agent: PaseoAgent): Coordinator {
  return {
    agentId: agent.id,
    title: agent.title ?? null,
    status: agent.status,
    cardOpen: (agent.labels?.["coord-card-open"] ?? "") !== "",
  };
}

function scopeOf(agent: PaseoAgent): string {
  return agent.labels?.["coord-scope"]?.trim() || "all";
}

function sessionOf(agent: PaseoAgent | undefined, workspace: PaseoWorkspace | undefined): Session | null {
  if (!agent) return null;
  return {
    title: agent.title ?? null,
    status: agent.status,
    requiresAttention: agent.requiresAttention === true,
    workspaceId: agent.workspaceId ?? null,
    workspaceName: workspace?.title ?? workspace?.name ?? null,
    projectName: workspace?.projectDisplayName ?? null,
  };
}

export async function describeScopes(paseo: PaseoApi, read: ReadScope[]): Promise<Scope[]> {
  const [agents, allWorkspaces] = await Promise.all([liveAgents(paseo), workspaces(paseo)]);
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const workspaceById = new Map(allWorkspaces.map((workspace) => [workspace.id, workspace]));
  const coordinators = new Map<string, Coordinator>();
  for (const agent of agents) {
    if (agent.labels?.["coord-role"] === COORDINATOR_ROLE && !agent.archivedAt) {
      coordinators.set(scopeOf(agent), coordinatorOf(agent));
    }
  }

  const projectName = (scope: string): string | null =>
    scope === "all" ? null : (allWorkspaces.find((workspace) => workspace.projectId === scope)?.projectDisplayName ?? null);

  const toCard = (scope: string, card: ReadScope["cards"][number]): Card => {
    const agent = agentById.get(card.sessionId);
    const workspace = agent?.workspaceId ? workspaceById.get(agent.workspaceId) : undefined;
    return {
      key: card.key,
      sessionId: card.sessionId,
      motif: card.motif,
      stream: card.stream,
      kind: card.kind,
      ask: card.ask,
      addedAt: card.addedAt,
      scope,
      report: card.report,
      session: sessionOf(agent, workspace),
    };
  };

  const scopes: Scope[] = read.map(({ scope, cards }) => ({
    scope,
    projectName: projectName(scope),
    coordinator: coordinators.get(scope) ?? null,
    cards: cards.map((card) => toCard(scope, card)),
  }));
  // A coordinator whose inbox has no file yet still has a chat to open.
  for (const [scope, coordinator] of coordinators) {
    if (!scopes.some((entry) => entry.scope === scope)) {
      scopes.push({ scope, projectName: projectName(scope), coordinator, cards: [] });
    }
  }
  return scopes;
}
