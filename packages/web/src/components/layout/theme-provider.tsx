"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

type WaypointTheme = {
  id: string;
  name: string;
  accent: string;
  accentSoft: string;
  overlay: string;
  glassFill: string;
  glassStroke: string;
  text: string;
  textMuted: string;
  shadow: string;
};

const WAYPOINT_THEMES: WaypointTheme[] = `classic|Classic|#5ba3f5|#dc2626|#03060e|rgba(13,20,35,0.74)|rgba(255,255,255,0.10)|#f1f5f9|#8d98ad|rgba(91,163,245,0.28)
garden-mint|Garden Mint|#4ade80|#2dd4bf|#03110d|rgba(8,33,27,0.76)|rgba(74,222,128,0.24)|#eefdf6|#90bbaa|rgba(45,212,191,0.28)
toxic-orchid|Toxic Orchid|#d946ef|#84cc16|#120315|rgba(35,10,42,0.78)|rgba(217,70,239,0.25)|#fff0ff|#c9a7ce|rgba(217,70,239,0.32)
midnight-violet|Midnight Violet|#8b5cf6|#38bdf8|#070414|rgba(20,14,44,0.78)|rgba(139,92,246,0.26)|#f6f1ff|#aaa0c7|rgba(139,92,246,0.35)
ocean-cobalt|Ocean Cobalt|#38bdf8|#2563eb|#03111e|rgba(5,25,45,0.78)|rgba(56,189,248,0.24)|#ecfbff|#91adc0|rgba(37,99,235,0.32)
ultraviolet-lagoon|Ultraviolet Lagoon|#a855f7|#4040a1|#070417|rgba(24,10,44,0.78)|rgba(168,85,247,0.25)|#f7efff|#a7a6c4|rgba(64,64,161,0.30)
sunset-coral|Sunset Coral|#fb7185|#f97316|#17070a|rgba(48,19,18,0.78)|rgba(251,113,133,0.25)|#fff4f3|#c7a19b|rgba(249,115,22,0.30)
amber-grove|Amber Grove|#f59e0b|#22c55e|#110d03|rgba(35,27,8,0.78)|rgba(245,158,11,0.25)|#fff9e8|#b9aa84|rgba(245,158,11,0.30)
rusted-aqua|Rusted Aqua|#14b8a6|#f97316|#071211|rgba(13,34,32,0.78)|rgba(20,184,166,0.24)|#effffc|#96b8b2|rgba(20,184,166,0.28)
rose-quartz|Rose Quartz|#f472b6|#fb7185|#170711|rgba(46,17,34,0.78)|rgba(244,114,182,0.25)|#fff2fa|#c7a0b7|rgba(244,114,182,0.30)
forest-emerald|Forest Emerald|#34d399|#16a34a|#03110a|rgba(6,32,20,0.78)|rgba(52,211,153,0.24)|#eefdf6|#8fb9a4|rgba(52,211,153,0.30)
deep-reef-ember|Deep Reef Ember|#22d3ee|#ef4444|#031018|rgba(7,28,39,0.78)|rgba(34,211,238,0.22)|#eefcff|#91b3bf|rgba(239,68,68,0.30)
cyber-teal|Cyber Teal|#2dd4bf|#67e8f9|#031312|rgba(5,34,33,0.78)|rgba(45,212,191,0.25)|#edfffd|#93beb9|rgba(45,212,191,0.32)
solar-yellow|Solar Yellow|#facc15|#38bdf8|#121003|rgba(37,33,8,0.78)|rgba(250,204,21,0.25)|#fffbe8|#beb58b|rgba(250,204,21,0.30)
acid-noir|Acid Noir|#a3e635|#22d3ee|#050805|rgba(13,22,13,0.82)|rgba(163,230,53,0.25)|#f7ffe8|#a8bb91|rgba(163,230,53,0.34)
indigo-night|Indigo Night|#6366f1|#06b6d4|#050616|rgba(13,16,43,0.80)|rgba(99,102,241,0.26)|#eef0ff|#9ea4c8|rgba(99,102,241,0.34)
lavender-mist|Lavender Mist|#c084fc|#60a5fa|#100a17|rgba(31,22,44,0.78)|rgba(192,132,252,0.25)|#fbf6ff|#bba7c9|rgba(192,132,252,0.28)
charcoal-mono|Charcoal Mono|#cbd5e1|#64748b|#050608|rgba(17,24,34,0.80)|rgba(203,213,225,0.18)|#f8fafc|#94a3b8|rgba(148,163,184,0.24)
paper-light|Paper Light|#2563eb|#f97316|#eef2f7|rgba(255,255,255,0.76)|rgba(37,99,235,0.22)|#0f172a|#64748b|rgba(37,99,235,0.20)
arctic-ice|Arctic Ice|#67e8f9|#93c5fd|#041014|rgba(8,32,40,0.78)|rgba(103,232,249,0.25)|#ecfeff|#95b7c0|rgba(103,232,249,0.32)
ink-melon|Ink Melon|#fb7185|#22c55e|#100710|rgba(31,16,31,0.78)|rgba(251,113,133,0.24)|#fff4f8|#c5a0ad|rgba(34,197,94,0.28)
volcanic-red|Volcanic Red|#ef4444|#f59e0b|#150504|rgba(43,12,10,0.80)|rgba(239,68,68,0.25)|#fff1f1|#c49b96|rgba(239,68,68,0.35)
mocha-brown|Mocha Brown|#d6a15f|#2dd4bf|#100907|rgba(36,24,18,0.80)|rgba(214,161,95,0.24)|#fff7ed|#b9a28d|rgba(214,161,95,0.28)
slate-blue|Slate Blue|#60a5fa|#94a3b8|#060b14|rgba(14,23,37,0.80)|rgba(96,165,250,0.24)|#f0f7ff|#9ca8b8|rgba(96,165,250,0.30)
neon-pink|Neon Pink|#ec4899|#22d3ee|#150515|rgba(43,10,39,0.80)|rgba(236,72,153,0.25)|#fff0f8|#c99fba|rgba(236,72,153,0.34)
sage-green|Sage Green|#86efac|#38bdf8|#07110a|rgba(15,32,20,0.78)|rgba(134,239,172,0.22)|#f2fff5|#9db9a4|rgba(134,239,172,0.26)
lunar-brass|Lunar Brass|#fbbf24|#94a3b8|#111006|rgba(33,30,16,0.80)|rgba(251,191,36,0.24)|#fff9e8|#b9ad91|rgba(251,191,36,0.30)
copper-bronze|Copper Bronze|#fb923c|#38bdf8|#120805|rgba(40,20,13,0.80)|rgba(251,146,60,0.24)|#fff3e8|#c0a08d|rgba(251,146,60,0.30)
crimson-wine|Crimson Wine|#e11d48|#a855f7|#150409|rgba(44,9,20,0.80)|rgba(225,29,72,0.25)|#fff0f4|#c49aa8|rgba(225,29,72,0.34)
powder-blue|Powder Blue|#93c5fd|#38bdf8|#05101a|rgba(10,30,49,0.78)|rgba(147,197,253,0.24)|#f0f8ff|#a6b9c8|rgba(147,197,253,0.28)
sandstone|Sandstone|#f4a261|#2dd4bf|#130d08|rgba(38,27,18,0.80)|rgba(244,162,97,0.24)|#fff5e9|#baa28e|rgba(244,162,97,0.28)
plasma-peacock|Plasma Peacock|#14b8a6|#d946ef|#041112|rgba(7,32,36,0.78)|rgba(20,184,166,0.24)|#effffc|#9bbac2|rgba(217,70,239,0.32)
magenta-storm|Magenta Storm|#d946ef|#64748b|#120515|rgba(34,14,42,0.80)|rgba(217,70,239,0.25)|#fff0ff|#b9a0c0|rgba(217,70,239,0.34)
pine-forest|Pine Forest|#22c55e|#84cc16|#031108|rgba(7,32,18,0.80)|rgba(34,197,94,0.25)|#effff3|#94b49d|rgba(34,197,94,0.30)
royal-purple|Royal Purple|#7c3aed|#f472b6|#080414|rgba(22,12,43,0.80)|rgba(124,58,237,0.26)|#f5efff|#aaa0c4|rgba(124,58,237,0.36)
tangerine|Tangerine|#fb923c|#facc15|#140905|rgba(42,21,12,0.80)|rgba(251,146,60,0.25)|#fff4e8|#c2a08b|rgba(251,146,60,0.32)`
  .trim()
  .split("\n")
  .map((line) => {
    const [
      id = "",
      name = "",
      accent = "",
      accentSoft = "",
      overlay = "",
      glassFill = "",
      glassStroke = "",
      text = "",
      textMuted = "",
      shadow = "",
    ] = line.split("|");
    return {
      id,
      name,
      accent,
      accentSoft,
      overlay,
      glassFill,
      glassStroke,
      text,
      textMuted,
      shadow,
    };
  });

export const THEME_OPTIONS = [
  { id: "light", name: "Repowise Light" },
  { id: "dark", name: "Repowise Dark" },
  ...WAYPOINT_THEMES.map((theme) => ({ id: theme.id, name: theme.name })),
];

export const CUSTOM_THEME_STORAGE_KEY = "repowise-custom-theme";
export const CUSTOM_THEME_EVENT = "repowise-custom-theme-change";

export function getStoredCustomTheme() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
  return WAYPOINT_THEMES.some((theme) => theme.id === stored) ? stored : null;
}

export function setStoredCustomTheme(themeId: string | null) {
  if (typeof window === "undefined") return;
  if (themeId && WAYPOINT_THEMES.some((theme) => theme.id === themeId)) {
    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, themeId);
  } else {
    window.localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
  }
  window.dispatchEvent(new Event(CUSTOM_THEME_EVENT));
}

export function getCustomThemeBase(themeId: string): "light" | "dark" {
  return themeId === "paper-light" ? "light" : "dark";
}

const CUSTOM_THEME_VARIABLES = [
  "--color-bg-root",
  "--color-bg-surface",
  "--color-bg-elevated",
  "--color-bg-overlay",
  "--color-bg-inset",
  "--color-bg-inset-on-overlay",
  "--color-border-default",
  "--color-border-hover",
  "--color-border-active",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-tertiary",
  "--color-text-on-accent",
  "--color-accent-primary",
  "--color-accent-fill",
  "--color-accent-fill-hover",
  "--color-accent-hover",
  "--color-accent-muted",
  "--color-accent-secondary",
  "--color-ramp-1",
  "--color-zoom-card-shadow",
] as const;

function hexLuminance(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return 0;
  const channels = [0, 2, 4].map(
    (offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function readableOnAccent(first: string, second: string) {
  return (hexLuminance(first) + hexLuminance(second)) / 2 > 0.48
    ? "#07111f"
    : "#ffffff";
}

function ThemeVariables({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [customTheme, setCustomTheme] = useState<string | null>(null);

  useEffect(() => {
    const legacyTheme = WAYPOINT_THEMES.find((item) => item.id === theme);
    if (legacyTheme && !getStoredCustomTheme()) {
      setStoredCustomTheme(legacyTheme.id);
      setTheme(getCustomThemeBase(legacyTheme.id));
    }
  }, [theme, setTheme]);

  useEffect(() => {
    const sync = () => setCustomTheme(getStoredCustomTheme());
    sync();
    window.addEventListener(CUSTOM_THEME_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CUSTOM_THEME_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    for (const variable of CUSTOM_THEME_VARIABLES) {
      root.style.removeProperty(variable);
    }

    const selected = WAYPOINT_THEMES.find((item) => item.id === customTheme);
    if (!selected) return;

    const inset = `color-mix(in srgb, ${selected.overlay} 86%, ${selected.accent})`;
    const variables: Record<string, string> = {
      "--color-bg-root": selected.overlay,
      "--color-bg-surface": selected.glassFill,
      "--color-bg-elevated": selected.glassFill,
      "--color-bg-overlay": selected.glassFill,
      "--color-bg-inset": inset,
      "--color-bg-inset-on-overlay": inset,
      "--color-border-default": selected.glassStroke,
      "--color-border-hover": `color-mix(in srgb, ${selected.accent} 42%, transparent)`,
      "--color-border-active": selected.accent,
      "--color-text-primary": selected.text,
      "--color-text-secondary": selected.textMuted,
      "--color-text-tertiary": selected.textMuted,
      "--color-text-on-accent": readableOnAccent(selected.accent, selected.accentSoft),
      "--color-accent-primary": selected.accent,
      "--color-accent-fill": selected.accent,
      "--color-accent-fill-hover": selected.accentSoft,
      "--color-accent-hover": selected.accentSoft,
      "--color-accent-muted": `color-mix(in srgb, ${selected.accent} 14%, transparent)`,
      "--color-accent-secondary": selected.accentSoft,
      "--color-ramp-1": selected.accentSoft,
      "--color-zoom-card-shadow": selected.shadow,
    };

    for (const [variable, value] of Object.entries(variables)) {
      root.style.setProperty(variable, value);
    }
  }, [customTheme]);

  return children;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      themes={["light", "dark"]}
      disableTransitionOnChange
    >
      <ThemeVariables>{children}</ThemeVariables>
    </NextThemesProvider>
  );
}
