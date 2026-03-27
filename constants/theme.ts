export type ColorScheme = "light" | "dark";

export interface ThemeColorPalette {
  background: string;
  foreground: string;
  surface: string;
  border: string;
  muted: string;
  primary: string;
  primaryForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  warning: string;
  error: string;
}

export const ThemeColors: Record<ColorScheme, ThemeColorPalette> = {
  light: {
    background: "#F5F8FA",
    foreground: "#111827",
    surface: "#FFFFFF",
    border: "#E5E7EB",
    muted: "#6B7280",
    primary: "#4CAF82",
    primaryForeground: "#FFFFFF",
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",
    success: "#4CAF82",
    warning: "#F59E0B",
    error: "#EF4444",
  },
  dark: {
    background: "#111827",
    foreground: "#F9FAFB",
    surface: "#1F2937",
    border: "#374151",
    muted: "#9CA3AF",
    primary: "#4CAF82",
    primaryForeground: "#FFFFFF",
    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",
    success: "#4CAF82",
    warning: "#F59E0B",
    error: "#EF4444",
  },
};

export const Colors = ThemeColors;
export const SchemeColors = ThemeColors;
export const Fonts = {};
