import { openExternalUrl } from "@getpaseo/plugin/client";
import { Icon, TextInput } from "@getpaseo/plugin/client/react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Card, Scope } from "../shared/cards";
import { CHAT_OPTIONS, DEFER_OPTIONS, primaryOptions, remindReply } from "../shared/reply";
import { addedAtLabel } from "../shared/time";
import { Body, Button, type Colors, Pill, Section } from "./ui";

/** One card as a slide: what the coordinator knows, the ask, and the replies it accepts. */

export interface CardActions {
  /** Sends a reply and moves to the next card. */
  answer(reply: string): void;
  /** Sends a reply the coordinator answers in its chat, then opens the chat. */
  askInChat(reply: string): void;
  openSession: (() => void) | null;
}

const KIND_LABEL: Record<string, string> = {
  decide: "Decide",
  do: "Do",
  accept: "Accept",
  remind: "Reminder",
};

function kindTone(kind: string): "accent" | "warning" | "success" | "muted" {
  if (kind === "decide") return "accent";
  if (kind === "do") return "warning";
  if (kind === "accept") return "success";
  return "muted";
}

function sessionStatus(card: Card): { label: string; tone: "muted" | "accent" | "warning" | "danger" } | null {
  const session = card.session;
  if (!session) return { label: "session gone", tone: "danger" };
  if (session.status === "running") return { label: "working", tone: "accent" };
  if (session.status === "error") return { label: "error", tone: "danger" };
  if (session.requiresAttention) return { label: "waiting on you", tone: "warning" };
  return null;
}

export function CardView({
  colors,
  compact,
  card,
  scope,
  showProject,
  position,
  sent,
  actions,
}: {
  colors: Colors;
  compact: boolean;
  card: Card;
  scope: Scope;
  showProject: boolean;
  position: { index: number; count: number };
  /** The reply already sent for this card, while the coordinator has yet to close it. */
  sent: string | null;
  actions: CardActions;
}) {
  const [words, setWords] = useState("");
  const [reminding, setReminding] = useState(false);
  const [when, setWhen] = useState("");
  const report = card.report;
  const status = sessionStatus(card);
  const project = card.session?.projectName ?? scope.projectName;
  const primary = primaryOptions(card.kind);

  const meta = [
    showProject && project ? project : null,
    `added ${addedAtLabel(card.addedAt)}`,
    report?.group ?? null,
    report?.effortMin ? `about ${report.effortMin} min` : null,
  ].filter((part): part is string => part !== null);

  return (
    <View
      style={{
        backgroundColor: colors.surface1,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: compact ? 16 : 24,
        gap: 18,
      }}
    >
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ color: colors.foreground, fontSize: 20, lineHeight: 26, fontWeight: "700", flex: 1 }} numberOfLines={2}>
            {card.motif ? `${card.motif} ${card.stream}` : card.stream}
          </Text>
          <Pill colors={colors} label={KIND_LABEL[card.kind] ?? card.kind} tone={kindTone(card.kind)} />
          <Text style={{ color: colors.foregroundMuted, fontSize: 13, lineHeight: 18 }}>
            {position.index + 1}/{position.count}
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.foregroundMuted, fontSize: 13, lineHeight: 18 }}>{meta.join(" · ")}</Text>
          {status ? <Pill colors={colors} label={status.label} tone={status.tone} /> : null}
        </View>
      </View>

      {report && report.links.length > 0 ? (
        <Section colors={colors} label="Work">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {report.links.map((link) => (
              <Pressable
                key={link.url}
                accessibilityRole="link"
                accessibilityLabel={link.state ? `${link.label}, ${link.state}` : link.label}
                onPress={() => void openExternalUrl(link.url)}
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <Icon name="ExternalLink" size={13} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>{link.label}</Text>
                {link.state ? <Text style={{ color: colors.foregroundMuted, fontSize: 13, lineHeight: 20 }}>{link.state}</Text> : null}
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      {report?.humanWords ? (
        <Section colors={colors} label="You asked">
          <View style={{ borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: 10 }}>
            <Body colors={colors}>“{report.humanWords}”</Body>
          </View>
        </Section>
      ) : null}

      {report?.since ? (
        <Section colors={colors} label="Since">
          <Body colors={colors}>{report.since}</Body>
        </Section>
      ) : null}

      <Section colors={colors} label={KIND_LABEL[card.kind] ?? "Ask"}>
        <Text style={{ color: colors.foreground, fontSize: 17, lineHeight: 24, fontWeight: "600" }}>{card.ask}</Text>
      </Section>

      {report?.recommend ? (
        <Section colors={colors} label="Recommend">
          <Body colors={colors}>{report.recommend}</Body>
        </Section>
      ) : null}

      {report?.evidence ? (
        <Section colors={colors} label="Evidence">
          <Body colors={colors} muted>
            {report.evidence}
          </Body>
        </Section>
      ) : null}

      {report?.rule ? (
        <Section colors={colors} label="Project rule">
          <Text style={{ color: colors.statusWarning, fontSize: 14, lineHeight: 20 }}>{report.rule}</Text>
        </Section>
      ) : null}

      {!card.report && card.kind !== "remind" ? (
        <Body colors={colors} muted>
          No report behind this card yet; the coordinator reads the session when you answer, or ask for a refresher.
        </Body>
      ) : null}

      {sent ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, gap: 4 }}>
          <Text style={{ color: colors.statusSuccess, fontSize: 15, lineHeight: 21, fontWeight: "600" }}>Sent: {sent}</Text>
          <Body colors={colors} muted>
            The coordinator closes the card once it has passed your answer on.
          </Body>
        </View>
      ) : (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, gap: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {primary.map((option) => (
              <Button
                key={option.word}
                colors={colors}
                variant="primary"
                label={option.label}
                hint={option.hint}
                onPress={() => actions.answer(option.word)}
                testID={`reply-${option.word}`}
              />
            ))}
            {DEFER_OPTIONS.map((option) => (
              <Button key={option.word} colors={colors} label={option.label} hint={option.hint} onPress={() => actions.answer(option.word)} />
            ))}
            <Button colors={colors} label="Remind…" hint="at a time you give" onPress={() => setReminding((open) => !open)} />
          </View>

          {reminding ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                accessibilityLabel="When to be reminded"
                value={when}
                onChangeText={setWhen}
                placeholder="tomorrow · Monday · at 3"
                placeholderTextColor={colors.foregroundMuted}
                onSubmitEditing={() => when.trim() && actions.answer(remindReply(when))}
                returnKeyType="send"
                style={inputStyle(colors)}
              />
              <Button colors={colors} variant="primary" label="Remind" disabled={!when.trim()} onPress={() => actions.answer(remindReply(when))} />
            </View>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              accessibilityLabel="Reply in your own words"
              value={words}
              onChangeText={setWords}
              placeholder="Or reply in your own words"
              placeholderTextColor={colors.foregroundMuted}
              onSubmitEditing={() => words.trim() && actions.answer(words)}
              returnKeyType="send"
              style={inputStyle(colors)}
            />
            <Button colors={colors} variant="primary" label="Send" disabled={!words.trim()} onPress={() => actions.answer(words)} />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            {CHAT_OPTIONS.map((option) => (
              <Button key={option.word} colors={colors} variant="quiet" label={option.label} hint={option.hint} onPress={() => actions.askInChat(option.word)} />
            ))}
            {actions.openSession ? (
              <Button colors={colors} variant="quiet" icon="SquareArrowOutUpRight" label="Open session" onPress={actions.openSession} />
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

function inputStyle(colors: Colors) {
  return {
    flex: 1,
    color: colors.foreground,
    backgroundColor: colors.surface0,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  };
}
