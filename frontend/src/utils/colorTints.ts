export interface ColorTints {
  dot: string;
  bg: string;
  fg: string;
  border: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(value, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function tints(hex: string): ColorTints {
  const { r, g, b } = hexToRgb(hex);
  return {
    dot: hex,
    bg: `rgba(${r}, ${g}, ${b}, 0.14)`,
    fg: hex,
    border: `rgba(${r}, ${g}, ${b}, 0.32)`,
  };
}

export const NEUTRAL_TINTS: ColorTints = {
  dot: "var(--color-text-tertiary)",
  bg: "var(--color-bg-tertiary)",
  fg: "var(--color-text-secondary)",
  border: "var(--color-border)",
};
