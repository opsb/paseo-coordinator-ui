import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { usePaseo } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { Coordinator, Deck } from "../shared/cards";
import { composeReply } from "../shared/reply";
import { CardView } from "./card-view";
import { Body, Button, type Colors } from "./ui";
import { type DeckEntry, flattenDeck, useDeck } from "./use-deck";

/**
 * The deck: one card at a time, in the order the inbox worker added them, with its replies as
 * buttons. A reply goes to the coordinator session as a chat message naming the card; the
 * coordinator relays it and ticks the card off, and the deck moves on at once.
 */

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The coordinator to chat with: the current card's, else the first scope that has one. */
function chatCoordinator(deck: Deck | null, current: DeckEntry | null): Coordinator | null {
  if (current?.scope.coordinator) return current.scope.coordinator;
  return deck?.scopes.find((scope) => scope.coordinator)?.coordinator ?? null;
}

function coordinatorLine(deck: Deck | null): string | null {
  const live = deck?.scopes.filter((scope) => scope.coordinator) ?? [];
  if (live.length === 0) return null;
  return live
    .map(({ scope, projectName, coordinator }) => {
      const where = scope === "all" ? "every project" : (projectName ?? scope);
      const doing = coordinator!.status === "running" ? "working" : coordinator!.cardOpen ? "a card open in chat" : "idle";
      return `Coordinator for ${where}: ${doing}`;
    })
    .join(" · ");
}

export function DeckScreen({ theme, layout, host, navigation }: PluginScreenProps) {
  const colors: Colors = theme.colors;
  const compact = layout.compact;
  const paseo = usePaseo();
  const toast = useToast();
  const { deck, error } = useDeck(host.id);
  const entries = useMemo(() => flattenDeck(deck), [deck]);

  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const lastIndex = useRef(0);
  const [sent, setSent] = useState<Record<string, string>>({});

  const foundAt = entries.findIndex((entry) => entry.card.key === currentKey);
  const index = foundAt >= 0 ? foundAt : Math.min(lastIndex.current, Math.max(0, entries.length - 1));
  lastIndex.current = index;
  const current = entries[index] ?? null;

  // A card the coordinator has closed takes its sent mark with it.
  useEffect(() => {
    setSent((marks) => {
      const keep = Object.fromEntries(Object.entries(marks).filter(([key]) => entries.some((entry) => entry.card.key === key)));
      return Object.keys(keep).length === Object.keys(marks).length ? marks : keep;
    });
  }, [entries]);

  const goTo = useCallback(
    (next: number) => {
      const entry = entries[next];
      if (entry) setCurrentKey(entry.card.key);
    },
    [entries],
  );

  const nextUnsent = useCallback(
    (from: number) => {
      for (let step = 1; step <= entries.length; step += 1) {
        const candidate = (from + step) % entries.length;
        if (!sent[entries[candidate].card.key]) return candidate;
      }
      return from;
    },
    [entries, sent],
  );

  const openAgent = useCallback(
    (agentId: string) => {
      if (!navigation) {
        toast.show("Open the session from the sidebar; this Paseo cannot open it from here.", { variant: "info" });
        return;
      }
      navigation.openAgent({ agentId, serverId: host.id });
    },
    [navigation, host.id, toast],
  );

  const send = useCallback(
    async (entry: DeckEntry, reply: string): Promise<boolean> => {
      const coordinator = entry.scope.coordinator;
      if (!coordinator) {
        toast.error("No coordinator session is running for this card. Start one with /coordinator.");
        return false;
      }
      try {
        await paseo.agents.ref(coordinator.agentId).send(composeReply(entry.card, reply), { activeTurnBehavior: "steer" });
      } catch (sendError) {
        toast.error(`Could not reach the coordinator: ${errorText(sendError)}`);
        return false;
      }
      setSent((marks) => ({ ...marks, [entry.card.key]: reply.trim() }));
      return true;
    },
    [paseo, toast],
  );

  const answer = useCallback(
    async (entry: DeckEntry, at: number, reply: string) => {
      if (!(await send(entry, reply))) return;
      toast.show(`Sent to the coordinator: ${reply.trim()}`, { variant: "success", durationMs: 2_500 });
      goTo(nextUnsent(at));
    },
    [send, toast, goTo, nextUnsent],
  );

  const askInChat = useCallback(
    async (entry: DeckEntry, reply: string) => {
      if (!(await send(entry, reply))) return;
      openAgent(entry.scope.coordinator!.agentId);
    },
    [send, openAgent],
  );

  const coordinator = chatCoordinator(deck, current);
  const status = coordinatorLine(deck);
  const showProject = (deck?.scopes.length ?? 0) > 1 || deck?.scopes[0]?.scope === "all";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface0 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: compact ? 16 : 24,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 20, fontWeight: "600" }}>
            {entries.length === 0 ? "Nothing needs you" : entries.length === 1 ? "1 card needs you" : `${entries.length} cards need you`}
          </Text>
          {status ? (
            <Text style={{ color: colors.foregroundMuted, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
              {status}
            </Text>
          ) : null}
        </View>
        {coordinator ? (
          <Button colors={colors} icon="MessageSquare" label="Chat" hint={compact ? undefined : "with the coordinator"} onPress={() => openAgent(coordinator.agentId)} />
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: compact ? 16 : 24, gap: 16, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        {error ? (
          <Text style={{ color: colors.statusDanger, fontSize: 14, lineHeight: 20 }}>Could not read the deck: {error}</Text>
        ) : null}

        {!deck && !error ? <Body colors={colors} muted>Reading the inbox…</Body> : null}

        {deck && deck.scopes.length === 0 ? (
          <View style={{ gap: 8 }}>
            <Body colors={colors}>No coordinator on {host.label}.</Body>
            <Body colors={colors} muted>
              The coordinator keeps its cards in {deck.stateRoot} on the machine that runs this daemon. Start one by sending /coordinator to a
              Paseo session there; the inbox worker then fills this deck as sessions stop.
            </Body>
          </View>
        ) : null}

        {deck && deck.scopes.length > 0 && entries.length === 0 ? (
          <Body colors={colors} muted>
            Every card is closed. New ones arrive here as sessions stop and the inbox worker reads them.
          </Body>
        ) : null}

        {current ? (
          <CardView
            key={current.card.key}
            colors={colors}
            compact={compact}
            card={current.card}
            scope={current.scope}
            showProject={showProject}
            position={{ index, count: entries.length }}
            sent={sent[current.card.key] ?? null}
            actions={{
              answer: (reply) => void answer(current, index, reply),
              askInChat: (reply) => void askInChat(current, reply),
              openSession: current.card.session ? () => openAgent(current.card.sessionId) : null,
            }}
          />
        ) : null}

        {entries.length > 1 ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Button colors={colors} icon="ChevronLeft" label="Previous" disabled={index === 0} onPress={() => goTo(index - 1)} />
            <View style={{ flexDirection: "row", gap: 6, flexShrink: 1, flexWrap: "wrap", justifyContent: "center" }}>
              {entries.map((entry, at) => (
                <View
                  key={entry.card.key}
                  accessibilityLabel={`Card ${at + 1}`}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: at === index ? colors.accent : sent[entry.card.key] ? colors.statusSuccess : colors.border,
                  }}
                />
              ))}
            </View>
            <Button colors={colors} label="Next" disabled={index >= entries.length - 1} onPress={() => goTo(index + 1)} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
