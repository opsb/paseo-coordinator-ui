import type { PluginClientContext } from "@getpaseo/plugin/client";
import { DeckScreen } from "./client/deck-screen";
import { CoordinatorSidebarItem, SCREEN_ID } from "./client/sidebar-item";

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: SCREEN_ID, title: "Coordinator", Component: DeckScreen });
  client.addSidebarHeaderItem({ id: "coordinator", title: "Coordinator", Component: CoordinatorSidebarItem });
  client.addCommandCenterItem({
    id: "open-deck",
    title: "Open coordinator cards",
    icon: "Layers",
    keywords: ["coordinator", "cards", "deck", "inbox"],
    context: "global",
    onSelect: ({ openScreen }) => openScreen({ screenId: SCREEN_ID }),
  });
  return () => {};
}
