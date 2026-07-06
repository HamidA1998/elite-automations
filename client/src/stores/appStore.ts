import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DashboardAppState, TimeTheme } from "@/types";

interface AppStore {
  state: DashboardAppState | null;
  loading: boolean;
  error: string | null;
  manualTheme: TimeTheme | null;
  sidebarCollapsed: boolean;
  liveEvents: Array<{ id: string; timestamp: string; agentId: string; agentName: string; type: string; content: string }>;

  setState: (state: DashboardAppState) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setManualTheme: (theme: TimeTheme | null) => void;
  toggleSidebar: () => void;
  addLiveEvent: (event: AppStore["liveEvents"][number]) => void;
  clearLiveEvents: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      state: null,
      loading: false,
      error: null,
      manualTheme: null,
      sidebarCollapsed: false,
      liveEvents: [],

      setState: (state) => set({ state }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setManualTheme: (theme) => set({ manualTheme: theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      addLiveEvent: (event) =>
        set((s) => ({
          liveEvents: [event, ...s.liveEvents].slice(0, 200),
        })),
      clearLiveEvents: () => set({ liveEvents: [] }),
    }),
    {
      name: "elite-app-store",
      partialize: (s) => ({ manualTheme: s.manualTheme, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);
