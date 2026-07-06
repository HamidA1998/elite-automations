import { useEffect, useMemo, useState } from "react";
import type { TimeMode } from "@/types/frontend";

export interface TimeState {
  now: Date;
  timeMode: TimeMode;
  greeting: string;
  dayLabel: string;
  timeLabel: string;
}

function getTimeMode(date: Date): TimeMode {
  const hour = date.getHours();
  if (hour >= 6 && hour < 11) return "dawn";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour >= 6 && hour < 11) return "Good morning, Hamid. Here's your day.";
  if (hour >= 11 && hour < 14) return "Good afternoon, Hamid. Here's where things stand.";
  if (hour >= 14 && hour < 18) return "Afternoon, Hamid. Still time to make moves today.";
  if (hour >= 18 && hour < 21) return "Evening, Hamid. Here's what got done today.";
  return "Late session, Hamid. Make it count.";
}

export function useTime(): TimeState {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const dayFormatter = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return {
      now,
      timeMode: getTimeMode(now),
      greeting: getGreeting(now),
      dayLabel: dayFormatter.format(now),
      timeLabel: formatter.format(now),
    };
  }, [now]);
}
