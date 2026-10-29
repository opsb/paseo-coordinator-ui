import type { PluginServerContext } from "@getpaseo/plugin/server";
import { closeCard, watchDeck } from "./shared/cards";
import { closeCard as tickOffCard } from "./server/close";
import { describeScopes } from "./server/sessions";
import { createDeckStore, stateRoot } from "./server/state";

/** How long a watch call waits for a change before answering with what it has. */
const WAIT_MS = 25_000;
/** Session events arrive in bursts; one touch per burst is enough. */
const TOUCH_SETTLE_MS = 300;

export default function contribute(server: PluginServerContext) {
  const root = stateRoot();
  const store = createDeckStore(root);

  let settle: ReturnType<typeof setTimeout> | null = null;
  const touch = () => {
    if (settle) clearTimeout(settle);
    settle = setTimeout(() => store.touch(), TOUCH_SETTLE_MS);
  };
  // A card's session status, and whether a coordinator is live, come from Paseo, not the files.
  const stopListening = [
    server.on("agent.created", touch),
    server.on("agent.closed", touch),
    server.on("agent.archived", touch),
    server.on("agent.turn_started", touch),
    server.on("agent.turn_ended", touch),
  ];

  server.handle(watchDeck, async ({ sinceRevision }, { paseo }) => {
    const { revision, scopes } = await store.waitForChange(sinceRevision, WAIT_MS);
    return { revision, stateRoot: root, scopes: await describeScopes(paseo, scopes) };
  });

  // The deck has already hidden the card; this makes that true for every client and across reloads.
  server.handle(closeCard, async ({ scope, key }) => {
    const outcome = await tickOffCard(root, scope, key);
    if (outcome === "closed") store.refresh();
    return { outcome };
  });

  return () => {
    if (settle) clearTimeout(settle);
    for (const stop of stopListening) stop();
    store.close();
  };
}
