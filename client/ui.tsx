import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

/** The few controls the deck is built from, styled from the host theme so they fit every Paseo theme. */

export type Colors = PluginTheme["colors"];

export type ButtonVariant = "primary" | "secondary" | "quiet";

export function Button({
  colors,
  label,
  hint,
  onPress,
  variant = "secondary",
  disabled = false,
  icon,
  testID,
}: {
  colors: Colors;
  label: string;
  hint?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  icon?: string;
  testID?: string;
}) {
  const filled = variant === "primary";
  const quiet = variant === "quiet";
  const foreground = filled ? colors.accentForeground : quiet ? colors.accent : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: quiet ? 6 : 9,
        paddingHorizontal: quiet ? 6 : 14,
        borderRadius: 8,
        borderWidth: quiet ? 0 : 1,
        borderColor: filled ? colors.accent : colors.border,
        backgroundColor: filled ? colors.accent : quiet ? "transparent" : colors.surface1,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={15} color={foreground} /> : null}
      <Text style={{ color: foreground, fontSize: 14, lineHeight: 18, fontWeight: filled ? "600" : "500" }}>{label}</Text>
      {hint && !quiet ? (
        <Text style={{ color: filled ? colors.accentForeground : colors.foregroundMuted, fontSize: 12, lineHeight: 16, opacity: filled ? 0.85 : 1 }}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function Pill({ colors, label, tone = "muted" }: { colors: Colors; label: string; tone?: "muted" | "accent" | "warning" | "success" | "danger" }) {
  const color = {
    muted: colors.foregroundMuted,
    accent: colors.accent,
    warning: colors.statusWarning,
    success: colors.statusSuccess,
    danger: colors.statusDanger,
  }[tone];
  return (
    <View style={{ paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: color }}>
      <Text style={{ color, fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</Text>
    </View>
  );
}

export function Section({ colors, label, children }: { colors: Colors; label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: colors.foregroundMuted, fontSize: 11, lineHeight: 14, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export function Body({ colors, children, muted = false }: { colors: Colors; children: ReactNode; muted?: boolean }) {
  return <Text style={{ color: muted ? colors.foregroundMuted : colors.foreground, fontSize: 15, lineHeight: 21 }}>{children}</Text>;
}

export function Badge({ colors, count }: { colors: Colors; count: number }) {
  return (
    <View
      accessibilityLabel={`${count} cards waiting`}
      style={{ minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.accent, alignItems: "center" }}
    >
      <Text style={{ color: colors.accentForeground, fontSize: 11, lineHeight: 15, fontWeight: "700" }}>{count}</Text>
    </View>
  );
}
