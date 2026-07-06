import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScheduleItem, Priority } from "@/types";

interface ScheduleStore {
  items: ScheduleItem[];
  streak: number;
  dailyTarget: number;
  addItem: (item: Omit<ScheduleItem, "id" | "createdAt">) => void;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
  setDailyTarget: (n: number) => void;
  getToday: () => ScheduleItem[];
}

function genId() {
  return `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function calcStreak(items: ScheduleItem[]): number {
  const completedDates = new Set(
    items
      .filter((i) => i.completed)
      .map((i) => i.date)
  );
  let streak = 0;
  const today = new Date();
  for (let d = 0; d < 365; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const key = date.toISOString().slice(0, 10);
    if (completedDates.has(key)) {
      streak++;
    } else if (d > 0) {
      break;
    }
  }
  return streak;
}

export const useScheduleStore = create<ScheduleStore>()(
  persist(
    (set, get) => ({
      items: [],
      streak: 0,
      dailyTarget: 10,

      addItem: (item) => {
        const newItem: ScheduleItem = {
          ...item,
          id: genId(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ items: [...s.items, newItem] }));
      },

      toggleItem: (id) => {
        set((s) => {
          const items = s.items.map((item) =>
            item.id === id ? { ...item, completed: !item.completed } : item
          );
          return { items, streak: calcStreak(items) };
        });
      },

      deleteItem: (id) => {
        set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
      },

      setDailyTarget: (n) => set({ dailyTarget: n }),

      getToday: () => {
        const today = new Date().toISOString().slice(0, 10);
        return get().items.filter((i) => i.date === today).sort((a, b) => a.time.localeCompare(b.time));
      },
    }),
    { name: "elite-schedule-store" }
  )
);

export function useDailyProgress(): { done: number; total: number; pct: number } {
  const store = useScheduleStore();
  const today = new Date().toISOString().slice(0, 10);
  const todayItems = store.items.filter((i) => i.date === today);
  const done = todayItems.filter((i) => i.completed).length;
  const total = Math.max(store.dailyTarget, todayItems.length);
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
