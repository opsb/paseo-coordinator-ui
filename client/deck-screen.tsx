import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { closeCard, type Coordinator, type Deck } from "../shared/cards";
import { composeReply } from "../shared/reply";
import { CardView } from "./card-view";
import { Body, Button, type Colors } from "./ui";
import { type DeckEntry, flattenDeck, useDeck } from "./use-deck";

/**
 * The deck: one card at a time, in the order the inbox worker added them, with its replies as
 * buttons. A press hides the card at once. The reply then goes to the coordinator session as a chat
 * message naming the card and its ask, and the daemon ticks the card off in the inbox so it stays
 * gone for every client; the coordinator relays from the message. A send that fails brings the
 * card back with the error.
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
      const doing =
        coordinator!.status === "running" ? "working" : coordinator!.cardOpen ? "a card open in chat" : "idle";
      return `Coordinator for ${where}: ${doing}`;
    })
    .join(" · ");
}

export function DeckScreen({ theme, layout, host, navigation }: PluginScreenProps) {
  const colors: Colors = theme.colors;
  const compact = layout.compact;
  const paseo = usePaseo();
  const toast = useToast();
  const close = useRpc(closeCard);
  const { deck, error } = useDeck(host.id);
  // Cards answered here are gone from the deck at once; the inbox catches up within a moment.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const entries = useMemo(() => flattenDeck(deck).filter((entry) => !hidden.has(entry.card.key)), [deck, hidden]);

  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const lastIndex = useRef(0);

  const foundAt = entries.findIndex((entry) => entry.card.key === currentKey);
  const index = foundAt >= 0 ? foundAt : Math.min(lastIndex.current, Math.max(0, entries.length - 1));
  lastIndex.current = index;
  const current = entries[index] ?? null;

  // A new card starts at its top, wherever the last one was scrolled to.
  const scroller = useRef<ScrollView>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [current?.card.key]);

  // Once the inbox no longer lists a hidden card, the mark has done its work.
  useEffect(() => {
    const listed = new Set(flattenDeck(deck).map((entry) => entry.card.key));
    setHidden((marks) => {
      const keep = new Set([...marks].filter((key) => listed.has(key)));
      return keep.size === marks.size ? marks : keep;
    });
  }, [deck]);

  const hide = useCallback((key: string) => setHidden((marks) => new Set(marks).add(key)), []);
  const unhide = useCallback(
    (key: string) =>
      setHidden((marks) => {
        const next = new Set(marks);
        next.delete(key);
        return next;
      }),
    [],
  );

  const goTo = useCallback(
    (next: number) => {
      const entry = entries[next];
      if (entry) setCurrentKey(entry.card.key);
    },
    [entries],
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

  /** Hides the card, sends the reply, then ticks the card off in the inbox. Brings it back if the send fails. */
  const send = useCallback(
    async (entry: DeckEntry, reply: string): Promise<boolean> => {
      const coordinator = entry.scope.coordinator;
      if (!coordinator) {
        toast.error("No coordinator session is running for this card. Start one with /coordinator.");
        return false;
      }
      hide(entry.card.key);
      try {
        await paseo.agents
          .ref(coordinator.agentId)
          .send(composeReply(entry.card, reply), { activeTurnBehavior: "steer" });
      } catch (sendError) {
        unhide(entry.card.key);
        toast.error(`Could not reach the coordinator: ${errorText(sendError)}`);
        return false;
      }
      try {
        await close({ scope: entry.scope.scope, key: entry.card.key });
      } catch (closeError) {
        // The reply is with the coordinator, which ticks the card off itself; the card stays hidden here.
        console.warn("[coordinator-ui] could not tick the card off", closeError);
      }
      return true;
    },
    [paseo, toast, close, hide, unhide],
  );

  const answer = useCallback(
    async (entry: DeckEntry, at: number, reply: string) => {
      // The deck shrinks by one at the hide, so the card that was next now sits at this index.
      const following = entries[at + 1] ?? entries[at - 1] ?? null;
      setCurrentKey(following?.card.key ?? null);
      if (!(await send(entry, reply))) {
        setCurrentKey(entry.card.key);
        return;
      }
      toast.show(`Sent to the coordinator: ${reply.trim()}`, { variant: "success", durationMs: 2_500 });
    },
    [entries, send, toast],
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
            {entries.length === 0
              ? "Nothing needs you"
              : entries.length === 1
                ? "1 card needs you"
                : `${entries.length} cards need you`}
          </Text>
          {status ? (
            <Text style={{ color: colors.foregroundMuted, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
              {status}
            </Text>
          ) : null}
        </View>
        {coordinator ? (
          <Button
            colors={colors}
            icon="MessageSquare"
            label="Chat"
            hint={compact ? undefined : "with the coordinator"}
            onPress={() => openAgent(coordinator.agentId)}
          />
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: compact ? 16 : 24,
          gap: 16,
          maxWidth: 760,
          width: "100%",
          alignSelf: "center",
        }}
      >
        {error ? (
          <Text style={{ color: colors.statusDanger, fontSize: 14, lineHeight: 20 }}>
            Could not read the deck: {error}
          </Text>
        ) : null}

        {!deck && !error ? (
          <Body colors={colors} muted>
            Reading the inbox…
          </Body>
        ) : null}

        {deck && deck.scopes.length === 0 ? (
          <View style={{ gap: 8 }}>
            <Body colors={colors}>No coordinator on {host.label}.</Body>
            <Body colors={colors} muted>
              The coordinator keeps its cards in {deck.stateRoot} on the machine that runs this daemon. Start one by
              sending /coordinator to a Paseo session there; the inbox worker then fills this deck as sessions stop.
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
            actions={{
              answer: (reply) => void answer(current, index, reply),
              askInChat: (reply) => void askInChat(current, reply),
              openSession: current.card.session ? () => openAgent(current.card.sessionId) : null,
            }}
          />
        ) : null}

        {entries.length > 1 ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Button
              colors={colors}
              icon="ChevronLeft"
              label="Previous"
              disabled={index === 0}
              onPress={() => goTo(index - 1)}
            />
            <View style={{ flexDirection: "row", gap: 6, flexShrink: 1, flexWrap: "wrap", justifyContent: "center" }}>
              {entries.map((entry, at) => (
                <View
                  key={entry.card.key}
                  accessibilityLabel={`Card ${at + 1}`}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: at === index ? colors.accent : colors.border,
                  }}
                />
              ))}
            </View>
            <Button
              colors={colors}
              label="Next"
              disabled={index >= entries.length - 1}
              onPress={() => goTo(index + 1)}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
