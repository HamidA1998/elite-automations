import { useEffect, useRef } from "react";
import { useScheduleStore } from "@/stores/scheduleStore";
import type { ScheduleItem } from "@/types";

export function useScheduleNotifications() {
  const items = useScheduleStore((s) => s.items);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const checkNotifications = () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const todayDate = now.toISOString().slice(0, 10);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      for (const item of items) {
        if (item.completed || item.date !== todayDate) continue;
        const [h, m] = item.time.split(":").map(Number);
        const itemMinutes = h * 60 + m;
        const diffMinutes = itemMinutes - nowMinutes;

        const exactKey = `exact:${item.id}`;
        const warnKey = `warn:${item.id}`;

        if (diffMinutes === 0 && !notifiedRef.current.has(exactKey)) {
          notifiedRef.current.add(exactKey);
          new Notification(`⏰ Now: ${item.title}`, {
            body: `${item.category} — ${item.priority} priority`,
            icon: "/favicon.ico",
          });
        } else if (diffMinutes === 15 && !notifiedRef.current.has(warnKey)) {
          notifiedRef.current.add(warnKey);
          new Notification(`⚡ 15 minutes: ${item.title}`, {
            body: `Starting at ${item.time} — ${item.category}`,
            icon: "/favicon.ico",
          });
        }
      }
    };

    const interval = setInterval(checkNotifications, 60_000);
    checkNotifications();
    return () => clearInterval(interval);
  }, [items]);
}

export function useNextScheduleItem(): ScheduleItem | null {
  const items = useScheduleStore((s) => s.items);
  const todayDate = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const upcoming = items
    .filter((item) => !item.completed && item.date === todayDate && item.time >= nowTime)
    .sort((a, b) => a.time.localeCompare(b.time));

  return upcoming[0] ?? null;
}
