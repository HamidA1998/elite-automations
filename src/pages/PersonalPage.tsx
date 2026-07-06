import { useState, useEffect, type CSSProperties, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Clock,
  Droplets,
  Heart,
  Moon,
  Sun,
  Sunrise,
  Target,
  Zap,
  Star,
  Activity,
  Calendar,
  CheckCircle2,
  Circle,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AladhanTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface AladhanResponse {
  data: {
    timings: AladhanTimings;
    date: {
      readable: string;
      hijri: {
        date: string;
        month: { en: string };
        year: string;
      };
    };
  };
}

// ─── Prayer times ──────────────────────────────────────────────────────────────

const PRAYER_ORDER = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
type PrayerName = (typeof PRAYER_ORDER)[number];
type PersonalIcon = ComponentType<{ size?: number; className?: string; style?: CSSProperties }>;

const PRAYER_META: Record<PrayerName, { icon: PersonalIcon; color: string; arabic: string }> = {
  Fajr:    { icon: Sunrise,  color: "#a78bfa", arabic: "الفجر" },
  Sunrise: { icon: Sun,      color: "#f59e0b", arabic: "الشروق" },
  Dhuhr:   { icon: Sun,      color: "#f97316", arabic: "الظهر" },
  Asr:     { icon: Activity, color: "#22c55e", arabic: "العصر" },
  Maghrib: { icon: Sunset,   color: "#ef4444", arabic: "المغرب" },
  Isha:    { icon: Moon,     color: "#6366f1", arabic: "العشاء" },
};

function Sunset({ size = 16, className = "", style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <path d="M17 18a5 5 0 0 0-10 0" />
      <line x1="12" y1="9" x2="12" y2="2" />
      <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
      <line x1="1" y1="18" x2="3" y2="18" />
      <line x1="21" y1="18" x2="23" y2="18" />
      <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
      <line x1="23" y1="22" x2="1" y2="22" />
      <polyline points="8 6 12 10 16 6" />
    </svg>
  );
}

async function fetchPrayerTimes(): Promise<AladhanResponse> {
  const res = await fetch(
    "https://api.aladhan.com/v1/timingsByCity?city=Manchester&country=UK&method=2",
  );
  if (!res.ok) throw new Error("Failed to load prayer times");
  return res.json();
}

function to24(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function to12(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function getNextPrayer(timings: AladhanTimings): { name: PrayerName; time: string; minutesLeft: number } | null {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (const prayer of PRAYER_ORDER) {
    const t = to24(timings[prayer]);
    if (t > nowMins) {
      return { name: prayer, time: timings[prayer], minutesLeft: t - nowMins };
    }
  }
  // After Isha — next is tomorrow's Fajr
  return { name: "Fajr", time: timings.Fajr, minutesLeft: (24 * 60 - nowMins) + to24(timings.Fajr) };
}

function fmtCountdown(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Daily quotes (rotates by day of week) ─────────────────────────────────────

const QUOTES = [
  { q: "The one who doesn't take risk doesn't build empires.", a: "Hamid.OS" },
  { q: "Plan as if you'll live forever. Work as if you'll die tomorrow.", a: "Islamic proverb" },
  { q: "Success is not final, failure is not fatal. The courage to continue is what counts.", a: "Winston Churchill" },
  { q: "If you want something you've never had, you must do something you've never done.", a: "Thomas Jefferson" },
  { q: "A year from now you'll wish you started today.", a: "Karen Lamb" },
  { q: "Every expert was once a beginner. Every professional was once an amateur.", a: "Robin Sharma" },
  { q: "Don't watch the clock; do what it does — keep going.", a: "Sam Levenson" },
];

const HABIT_ICONS = {
  hydration: Droplets,
  exercise: Activity,
  quran: BookOpen,
  sleep: Moon,
  dhikr: Heart,
} satisfies Record<string, PersonalIcon>;

type HabitIconKey = keyof typeof HABIT_ICONS;

interface PersonalGoal {
  id: number;
  text: string;
  done: boolean;
}

interface PersonalHabit {
  id: string;
  icon: HabitIconKey;
  label: string;
  done: boolean;
}

interface PersonalState {
  goals: PersonalGoal[];
  habits: PersonalHabit[];
}

const PERSONAL_STORAGE_KEY = "elite-personal-command-v1";

const DEFAULT_GOALS: PersonalGoal[] = [
  { id: 1, text: "Complete Elite Automations onboarding flow", done: false },
  { id: 2, text: "Close first paying client", done: false },
  { id: 3, text: "Launch NurAI on App Store", done: false },
  { id: 4, text: "Build Capital trading strategy", done: false },
  { id: 5, text: "Read 30 minutes daily", done: false },
];

const DEFAULT_HABITS: PersonalHabit[] = [
  { id: "hydration", icon: "hydration", label: "Hydration target", done: false },
  { id: "exercise",  icon: "exercise",  label: "Move body", done: false },
  { id: "quran",     icon: "quran",     label: "Quran reading", done: false },
  { id: "sleep",     icon: "sleep",     label: "Sleep protected", done: false },
  { id: "dhikr",     icon: "dhikr",     label: "Morning dhikr", done: false },
];

function readPersonalState(): PersonalState {
  if (typeof window === "undefined") return {goals: DEFAULT_GOALS, habits: DEFAULT_HABITS};
  try {
    const raw = window.localStorage.getItem(PERSONAL_STORAGE_KEY);
    if (!raw) return {goals: DEFAULT_GOALS, habits: DEFAULT_HABITS};
    const parsed = JSON.parse(raw) as Partial<PersonalState>;
    return {
      goals: Array.isArray(parsed.goals) ? parsed.goals : DEFAULT_GOALS,
      habits: Array.isArray(parsed.habits) ? parsed.habits : DEFAULT_HABITS,
    };
  } catch {
    return {goals: DEFAULT_GOALS, habits: DEFAULT_HABITS};
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PersonalPage() {
  const initialState = readPersonalState();
  const [goals, setGoals] = useState<PersonalGoal[]>(initialState.goals);
  const [habits, setHabits] = useState<PersonalHabit[]>(initialState.habits);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify({goals, habits}));
  }, [goals, habits]);

  const { data: prayerData, isLoading: prayerLoading, error: prayerError } = useQuery({
    queryKey: ["prayer-times"],
    queryFn: fetchPrayerTimes,
    staleTime: 5 * 60 * 1000,
  });

  const timings = prayerData?.data?.timings;
  const hijriDate = prayerData?.data?.date?.hijri;
  const nextPrayer = timings ? getNextPrayer(timings) : null;
  const todayQuote = QUOTES[now.getDay() % QUOTES.length];
  const completedGoals = goals.filter((g) => g.done).length;
  const completedHabits = habits.filter((h) => h.done).length;

  const quickLinks = [
    { to: "/",        icon: Zap,      label: "Command Centre", color: "var(--color-accent)" },
    { to: "/planner", icon: Calendar, label: "Planner",        color: "#22c55e" },
    { to: "/agents",  icon: Star,     label: "Agent Fleet",    color: "#a78bfa" },
    { to: "/ai",      icon: BookOpen, label: "ORACLE Brief",   color: "#f59e0b" },
  ];

  return (
    <PageWrapper
      eyebrow="HAMID.OS · PERSONAL"
      title="PERSONAL COMMAND"
      description="Prayer times, daily habits, goals, and your personal rhythm"
    >
      <div className="space-y-6 max-w-5xl">

        {/* Prayer times — top section */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Islamic prayer times</p>
              <h2 className="display-title !text-[var(--text-lg)]">Manchester, UK</h2>
            </div>
            <div className="text-right">
              {hijriDate ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  {hijriDate.date} {hijriDate.month.en} {hijriDate.year} AH
                </p>
              ) : null}
              <p className="text-xs text-[var(--color-text-muted)]">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
          </div>

          {/* Next prayer countdown */}
          {nextPrayer && !prayerLoading && (
            <div
              className="rounded-[var(--radius-xl)] p-4 flex items-center justify-between"
              style={{ background: `${PRAYER_META[nextPrayer.name].color}15`, border: `1px solid ${PRAYER_META[nextPrayer.name].color}30` }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex size-10 items-center justify-center rounded-full"
                  style={{ background: `${PRAYER_META[nextPrayer.name].color}22`, color: PRAYER_META[nextPrayer.name].color }}
                >
                  {(() => { const I = PRAYER_META[nextPrayer.name].icon; return <I size={18} />; })()}
                </span>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Next prayer</p>
                  <p className="font-bold text-[var(--color-text)]">{nextPrayer.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="metric-mono text-2xl font-bold" style={{ color: PRAYER_META[nextPrayer.name].color }}>
                  {to12(nextPrayer.time)}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">in {fmtCountdown(nextPrayer.minutesLeft)}</p>
              </div>
            </div>
          )}

          {/* All prayers grid */}
          {prayerLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-[var(--radius-xl)] animate-pulse bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : prayerError ? (
            <div className="text-sm text-[var(--color-text-muted)] text-center py-4">
              Could not load prayer times. Check your internet connection.
            </div>
          ) : timings ? (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {PRAYER_ORDER.map((prayer) => {
                const meta = PRAYER_META[prayer];
                const isNext = nextPrayer?.name === prayer;
                const nowMins = now.getHours() * 60 + now.getMinutes();
                const isPast = to24(timings[prayer]) < nowMins && !isNext;
                const Icon = meta.icon;
                return (
                  <div
                    key={prayer}
                    className={`rounded-[var(--radius-xl)] p-3 text-center space-y-1.5 transition-all`}
                    style={{
                      background: isNext ? `${meta.color}15` : "var(--color-surface-2)",
                      outline: isNext ? `1px solid ${meta.color}66` : undefined,
                      opacity: isPast ? 0.5 : 1,
                    }}
                  >
                    <Icon size={16} className="mx-auto" style={{ color: meta.color }} />
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>{prayer}</p>
                    <p className="font-mono text-sm font-bold text-[var(--color-text)]">{to12(timings[prayer])}</p>
                    <p className="text-[9px] text-[var(--color-text-muted)] font-arabic">{meta.arabic}</p>
                    {isNext && <p className="text-[9px]" style={{ color: meta.color }}>NEXT ↑</p>}
                  </div>
                );
              })}
            </div>
          ) : null}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">

          {/* Daily brief */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="section-kicker">Daily brief</p>
              <Sun size={16} className="text-[var(--color-gold)]" />
            </div>
            <blockquote className="space-y-2">
              <p className="text-base font-semibold text-[var(--color-text)] leading-snug italic">
                "{todayQuote.q}"
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">— {todayQuote.a}</p>
            </blockquote>
            <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
              <p className="text-xs text-[var(--color-text-muted)]">
                {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <Clock size={11} />
                {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </Card>

          {/* Daily wellness habits */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="section-kicker">Daily habits</p>
                <h3 className="font-semibold text-sm text-[var(--color-text)]">Today's wellness</h3>
              </div>
              <Badge variant={completedHabits === habits.length ? "success" : completedHabits > 0 ? "warning" : "neutral"}>
                {completedHabits}/{habits.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {habits.map((habit) => (
                (() => {
                  const Icon = HABIT_ICONS[habit.icon] ?? Circle;
                  return (
                    <button
                      key={habit.id}
                      onClick={() => setHabits((prev) => prev.map((h) => h.id === habit.id ? { ...h, done: !h.done } : h))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-xl)] transition-all text-left ${
                        habit.done ? "bg-green-500/10 border border-green-500/20" : "bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30"
                      }`}
                    >
                      {habit.done
                        ? <CheckCircle2 size={15} className="text-green-400 shrink-0" />
                        : <Icon size={15} className="text-[var(--color-text-muted)] shrink-0" />
                      }
                      <span className="text-sm">{habit.label}</span>
                    </button>
                  );
                })()
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-6 space-y-4">
          <div>
            <p className="section-kicker">Life dashboard</p>
            <h2 className="display-title !text-[var(--text-lg)]">Personal operating balance</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
              A quick read on the parts of life that need protecting while the business scales.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {[
              {label: "Faith", value: nextPrayer ? `Next: ${nextPrayer.name}` : "Prayer sync", icon: Heart, tone: "#a78bfa"},
              {label: "Health", value: `${completedHabits}/${habits.length} habits`, icon: Activity, tone: "#22c55e"},
              {label: "Focus", value: `${completedGoals}/${goals.length} goals`, icon: Target, tone: "var(--color-accent)"},
              {label: "Rest", value: habits.find((habit) => habit.id === "sleep")?.done ? "Protected" : "Plan tonight", icon: Moon, tone: "#06b6d4"},
              {label: "Learning", value: habits.find((habit) => habit.id === "quran")?.done || goals.find((goal) => goal.text.toLowerCase().includes("read"))?.done ? "Done today" : "Open loop", icon: BookOpen, tone: "#f59e0b"},
            ].map(({label, value, icon: Icon, tone}) => (
              <div key={label} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <Icon size={16} style={{color: tone}} />
                <p className="mt-3 section-kicker">{label}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{value}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Goals tracker */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-kicker">Goals tracker</p>
              <h2 className="display-title !text-[var(--text-lg)]">Personal milestones</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-24 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                  style={{ width: `${goals.length > 0 ? (completedGoals / goals.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">{completedGoals}/{goals.length}</span>
            </div>
          </div>
          <div className="space-y-2">
            {goals.map((goal) => (
              <button
                key={goal.id}
                onClick={() => setGoals((prev) => prev.map((g) => g.id === goal.id ? { ...g, done: !g.done } : g))}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-xl)] transition-all text-left group ${
                  goal.done
                    ? "bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20"
                    : "bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30"
                }`}
              >
                {goal.done
                  ? <CheckCircle2 size={16} className="text-[var(--color-accent)] shrink-0" />
                  : <Target size={16} className="text-[var(--color-text-muted)] shrink-0" />
                }
                <span className={`text-sm flex-1 ${goal.done ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text)]"}`}>
                  {goal.text}
                </span>
                <Heart size={12} className={`shrink-0 transition-opacity ${goal.done ? "text-[var(--color-accent)] opacity-100" : "opacity-0 group-hover:opacity-30"}`} />
              </button>
            ))}
          </div>
        </Card>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {quickLinks.map(({ to, icon: Icon, label, color }) => (
            <Link
              key={to}
              to={to}
              className="group flex flex-col items-center gap-3 p-5 rounded-[var(--radius-2xl)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-surface-3)] transition-all"
            >
              <span
                className="inline-flex size-12 items-center justify-center rounded-full transition-transform group-hover:scale-110"
                style={{ background: `${color}22`, color }}
              >
                <Icon size={20} />
              </span>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
              </div>
              <ChevronRight size={13} className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>

      </div>
    </PageWrapper>
  );
}
