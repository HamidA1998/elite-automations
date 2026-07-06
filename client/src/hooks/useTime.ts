import { useState, useEffect, useCallback } from "react";
import type { TimeTheme } from "@/types";

export interface TimeInfo {
  now: Date;
  timeString: string;
  dateString: string;
  dayString: string;
  greeting: string;
  theme: TimeTheme;
  hour: number;
  minute: number;
}

function getTheme(hour: number): TimeTheme {
  if (hour >= 6 && hour < 11)  return "dawn";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

function getGreeting(hour: number, name = "Hamid"): string {
  if (hour >= 6  && hour < 11) return `Good morning, ${name}. Here's your day.`;
  if (hour >= 11 && hour < 14) return `Good afternoon, ${name}. Here's where things stand.`;
  if (hour >= 14 && hour < 18) return `Afternoon, ${name}. Still time to make moves today.`;
  if (hour >= 18 && hour < 21) return `Evening, ${name}. Here's what got done today.`;
  return `Late session, ${name}. Make it count.`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "long" });
}

export function useTime(ownerName = "Hamid"): TimeInfo {
  const getInfo = useCallback((): TimeInfo => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    return {
      now,
      timeString: formatTime(now),
      dateString: formatDate(now),
      dayString: formatDay(now),
      greeting: getGreeting(hour, ownerName),
      theme: getTheme(hour),
      hour,
      minute,
    };
  }, [ownerName]);

  const [info, setInfo] = useState<TimeInfo>(getInfo);

  useEffect(() => {
    const interval = setInterval(() => setInfo(getInfo()), 1000);
    return () => clearInterval(interval);
  }, [getInfo]);

  return info;
}

export function useAutoTheme(manualTheme: TimeTheme | null): TimeTheme {
  const { theme } = useTime();
  return manualTheme ?? theme;
}
