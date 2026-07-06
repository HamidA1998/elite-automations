import { useEffect, useMemo, useState } from "react";
import { useScheduleStore } from "@/stores/schedule-store";
import { useSettingsStore } from "@/stores/settings-store";

interface NotificationState {
  permission: NotificationPermission | "unsupported";
  requestPermission: () => Promise<void>;
}

function sameDay(left: Date, right: Date): boolean {
  return left.toDateString() === right.toDateString();
}

export function useNotifications(): NotificationState {
  const items = useScheduleStore((state) => state.items);
  const setDelivered = useScheduleStore((state) => state.setDelivered);
  const clearDeliveredBefore = useScheduleStore((state) => state.clearDeliveredBefore);
  const preferences = useSettingsStore((state) => state.notificationPreferences);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  useEffect(() => {
    if (permission === "unsupported" || permission !== "granted") return;

    const tick = () => {
      const now = new Date();
      // Read delivered directly from store so this fn doesn't need to be in the deps array
      const { deliveredNotifications } = useScheduleStore.getState();
      clearDeliveredBefore(`${now.toISOString().slice(0, 10)}-stale`);

      items.forEach((item) => {
        if (item.completed) return;
        const eventDate = new Date(`${item.date}T${item.time}:00`);
        if (!sameDay(eventDate, now)) return;

        const diffMinutes = Math.round((eventDate.getTime() - now.getTime()) / 60000);
        const warningKey = `${item.id}-warning`;
        const liveKey = `${item.id}-live`;

        if (
          preferences.fifteenMinuteWarning &&
          diffMinutes <= 15 &&
          diffMinutes > 14 &&
          !deliveredNotifications.includes(warningKey)
        ) {
          new Notification(`Upcoming: ${item.title}`, {
            body: `${item.category} at ${item.time} in 15 minutes.`,
          });
          setDelivered(warningKey);
        }

        if (
          preferences.onTimeReminder &&
          diffMinutes <= 0 &&
          diffMinutes > -1 &&
          !deliveredNotifications.includes(liveKey)
        ) {
          new Notification(`Now: ${item.title}`, {
            body: `${item.category} is due now.`,
          });
          setDelivered(liveKey);
        }
      });
    };

    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
    // `delivered` intentionally excluded from deps — read via getState() to prevent
    // the infinite loop: clearDeliveredBefore → new array ref → effect re-fires → loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearDeliveredBefore, items, permission, preferences, setDelivered]);

  const requestPermission = useMemo(
    () => async () => {
      if (!("Notification" in window)) {
        setPermission("unsupported");
        return;
      }
      const next = await Notification.requestPermission();
      setPermission(next);
    },
    [],
  );

  return { permission, requestPermission };
}
