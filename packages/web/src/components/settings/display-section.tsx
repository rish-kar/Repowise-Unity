"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { OverviewSection } from "@repowise-dev/ui/overview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repowise-dev/ui/ui/select";
import {
  SettingsRow,
  SettingsRows,
  SaveIndicator,
  type SaveState,
} from "@repowise-dev/ui/settings";
import { Switch } from "@repowise-dev/ui/ui/switch";
import { DEFAULT_WEEKEND_PRESET, WEEKEND_PRESETS } from "@repowise-dev/ui/stats";
import {
  CUSTOM_THEME_EVENT,
  THEME_OPTIONS,
  getCustomThemeBase,
  getStoredCustomTheme,
  setStoredCustomTheme,
} from "@/components/layout/theme-provider";
import { config, setChatDockHidden } from "@/lib/config";

/** Reader-local display preferences for the stats surfaces. */
export function DisplaySection() {
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState("light");
  const [weekend, setWeekend] = useState(DEFAULT_WEEKEND_PRESET.id);
  const [dockShown, setDockShown] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read after mount so SSR and the first client render agree.
  useEffect(() => {
    setWeekend(config.getWeekend() || DEFAULT_WEEKEND_PRESET.id);
    setDockShown(!config.getChatDockHidden());
  }, []);

  useEffect(() => {
    const syncTheme = () => {
      setSelectedTheme(getStoredCustomTheme() ?? (theme === "dark" ? "dark" : "light"));
    };
    syncTheme();
    window.addEventListener(CUSTOM_THEME_EVENT, syncTheme);
    return () => window.removeEventListener(CUSTOM_THEME_EVENT, syncTheme);
  }, [theme]);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  function markSaved() {
    setSaveState("saved");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaveState("idle"), 2000);
  }

  function handleThemeChange(v: string) {
    setSelectedTheme(v);
    if (v === "light" || v === "dark") {
      setStoredCustomTheme(null);
      setTheme(v);
    } else {
      setStoredCustomTheme(v);
      setTheme(getCustomThemeBase(v));
    }
    markSaved();
  }

  function handleChange(v: string) {
    setWeekend(v);
    config.setWeekend(v);
    markSaved();
  }

  function handleDockChange(shown: boolean) {
    setDockShown(shown);
    // Goes through the helper, not `config` directly: the dock is mounted on a
    // different route and needs the event to notice.
    setChatDockHidden(!shown);
    markSaved();
  }

  return (
    <OverviewSection
      title="Display"
      description="What this browser shows and how it presents it. Nothing here changes the index."
      action={<SaveIndicator state={saveState} />}
    >
      <SettingsRows>
        <SettingsRow label="Theme" hint="Choose the application colour theme.">
          <Select value={selectedTheme} onValueChange={handleThemeChange}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow
          label="Weekend days"
          hint="Drives the “on weekends” share on the coding-rhythm heatmap."
        >
          <Select value={weekend} onValueChange={handleChange}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKEND_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>
        <SettingsRow
          label="Ask Repowise"
          hint="The chat pill in the bottom-right of every repository page. Hiding it does not affect the full chat page."
        >
          <Switch
            checked={dockShown}
            onCheckedChange={handleDockChange}
            aria-label="Show the Ask Repowise chat pill"
          />
        </SettingsRow>
      </SettingsRows>
    </OverviewSection>
  );
}
