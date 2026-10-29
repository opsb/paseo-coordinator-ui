import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { Badge } from "./ui";
import { openCount, useDeck } from "./use-deck";

export const SCREEN_ID = "deck";

/** The sidebar row: opens the deck, and carries the number of cards waiting. */
export function CoordinatorSidebarItem({ currentScreen, openScreen, host, theme }: PluginSidebarItemProps) {
  const { deck } = useDeck(host.id);
  const count = openCount(deck);
  return (
    <SidebarRow
      icon="Layers"
      active={currentScreen?.screenId === SCREEN_ID}
      onPress={() => openScreen({ screenId: SCREEN_ID })}
      trailing={count > 0 ? <Badge colors={theme.colors} count={count} /> : undefined}
    />
  );
}
