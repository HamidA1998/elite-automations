import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeMode, TimeMode } from "@/types/frontend";

interface ThemeStore {
  themeMode: ThemeMode;
  setThemeMode: (themeMode: ThemeMode) => void;
  resolveTheme: (timeMode: TimeMode) => Exclude<ThemeMode, "auto">;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      themeMode: "night",
      setThemeMode: (themeMode) => set({ themeMode }),
      resolveTheme: (timeMode) => {
        const current = get().themeMode;
        return current === "auto" ? timeMode : current;
      },
    }),
    {
      name: "elite-ops-theme-v2",
      partialize: (state) => ({ themeMode: state.themeMode }),
    },
  ),
);
