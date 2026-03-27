import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  // Navigation
  "house.fill": "home",
  "cart.fill": "shopping-cart",
  "clock.fill": "history",
  "person.fill": "person",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",

  // Actions
  "plus": "add",
  "plus.circle.fill": "add-circle",
  "pencil": "edit",
  "trash.fill": "delete",
  "xmark": "close",
  "xmark.circle.fill": "cancel",
  "checkmark": "check",
  "checkmark.circle.fill": "check-circle",

  // Shopping & Family
  "key.fill": "vpn-key",
  "person.2.fill": "group",
  "person.fill.xmark": "person-remove",
  "arrow.right.square.fill": "logout",
  "doc.on.doc.fill": "content-copy",
  "square.and.arrow.up": "share",

  // Charts & Stats
  "chart.line.uptrend.xyaxis": "trending-up",
  "arrow.up.right": "north-east",
  "arrow.down.right": "south-east",
  "arrow.right": "arrow-forward",
  "sparkle": "auto-awesome",

  // Misc
  "star.fill": "star",
  "bell.fill": "notifications",
  "gear": "settings",
  "info.circle.fill": "info",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
