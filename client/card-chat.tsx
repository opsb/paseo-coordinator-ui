import { TextInput } from "@getpaseo/plugin/client/react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import type { Thread } from "../shared/chat";
import { Button, type Colors } from "./ui";

/**
 * The chat under a card: what you asked, what the coordinator answered, and a line for the next
 * question. It stays until the card is resolved with a reply above, or closed here.
 */
export function CardChat({
  colors,
  thread,
  onSend,
  onClose,
}: {
  colors: Colors;
  thread: Thread;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.foregroundMuted, fontSize: 11, lineHeight: 14, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
          Chat about this card
        </Text>
        <Button colors={colors} variant="quiet" icon="X" label="Close" onPress={onClose} />
      </View>

      {thread.messages.length === 0 && !thread.busy ? (
        <Text style={{ color: colors.foregroundMuted, fontSize: 14, lineHeight: 20 }}>
          Ask the coordinator anything about this card. It answers here; the card stays open until you reply above.
        </Text>
      ) : null}

      <View style={{ gap: 8 }}>
        {thread.messages.map((message) => (
          <Bubble key={message.id} colors={colors} from={message.from} text={message.text} />
        ))}
        {thread.busy ? (
          <Text style={{ color: colors.foregroundMuted, fontSize: 13, lineHeight: 18, fontStyle: "italic" }}>
            The coordinator is thinking…
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TextInput
          accessibilityLabel="Ask the coordinator about this card"
          value={text}
          onChangeText={setText}
          placeholder="Ask the coordinator…"
          placeholderTextColor={colors.foregroundMuted}
          onSubmitEditing={submit}
          returnKeyType="send"
          autoFocus
          style={{
            flex: 1,
            color: colors.foreground,
            backgroundColor: colors.surface0,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            fontSize: 15,
          }}
        />
        <Button colors={colors} variant="primary" label="Ask" disabled={!text.trim()} onPress={submit} />
      </View>
    </View>
  );
}

function Bubble({ colors, from, text }: { colors: Colors; from: "you" | "coordinator" | "note"; text: string }) {
  if (from === "note") {
    return <Text style={{ color: colors.statusWarning, fontSize: 13, lineHeight: 18 }}>{text}</Text>;
  }
  const you = from === "you";
  return (
    <View
      style={{
        alignSelf: you ? "flex-end" : "flex-start",
        maxWidth: "88%",
        backgroundColor: you ? colors.accent : colors.surface0,
        borderColor: you ? colors.accent : colors.border,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: you ? colors.accentForeground : colors.foreground, fontSize: 15, lineHeight: 21 }}>{text.trim()}</Text>
    </View>
  );
}
