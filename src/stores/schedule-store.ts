import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScheduleCategory, ScheduleItem, SchedulePriority } from "@/types/frontend";

export interface ScheduleDraft {
  title: string;
  date: string;
  time: string;
  priority: SchedulePriority;
  category: ScheduleCategory;
}

interface ScheduleStore {
  items: ScheduleItem[];
  deliveredNotifications: string[];
  addItem: (draft: ScheduleDraft) => void;
  addItems: (drafts: ScheduleDraft[]) => void;
  toggleComplete: (id: string) => void;
  removeItem: (id: string) => void;
  setDelivered: (notificationId: string) => void;
  clearDeliveredBefore: (prefix: string) => void;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useScheduleStore = create<ScheduleStore>()(
  persist(
    (set) => ({
      items: [],
      deliveredNotifications: [],
      addItem: (draft) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              id: uid(),
              completed: false,
              createdAt: new Date().toISOString(),
              ...draft,
            },
          ].sort((a, b) =>
            `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
          ),
        })),
      addItems: (drafts) =>
        set((state) => ({
          items: [
            ...state.items,
            ...drafts.map((draft) => ({
              id: uid(),
              completed: false,
              createdAt: new Date().toISOString(),
              ...draft,
            })),
          ].sort((a, b) =>
            `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
          ),
        })),
      toggleComplete: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, completed: !item.completed } : item,
          ),
        })),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      setDelivered: (notificationId) =>
        set((state) => ({
          deliveredNotifications: Array.from(
            new Set([...state.deliveredNotifications, notificationId]),
          ),
        })),
      clearDeliveredBefore: (prefix) =>
        set((state) => {
          const filtered = state.deliveredNotifications.filter(
            (id) => !id.startsWith(prefix),
          );
          // Bail out early if nothing actually changed (avoids spurious re-renders)
          if (filtered.length === state.deliveredNotifications.length) return state;
          return { deliveredNotifications: filtered };
        }),
    }),
    {
      name: "elite-ops-schedule",
      partialize: (state) => ({
        items: state.items,
        deliveredNotifications: state.deliveredNotifications,
      }),
    },
  ),
);
