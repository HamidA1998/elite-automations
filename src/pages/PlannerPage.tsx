import { CalendarDays, Clock3 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { ScheduleComposer } from "@/components/features/ScheduleComposer";
import { HourlyPlanner } from "@/components/features/HourlyPlanner";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Progress } from "@/components/ui/Progress";
import { useMemo, useState } from "react";
import { sendOpenClawCommand } from "@/services/api";
import { useScheduleStore } from "@/stores/schedule-store";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PlannerPage() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [planReply, setPlanReply] = useState("");
  const items = useScheduleStore((state) => state.items);
  const addItems = useScheduleStore((state) => state.addItems);
  const toggleComplete = useScheduleStore((state) => state.toggleComplete);
  const removeItem = useScheduleStore((state) => state.removeItem);
  const today = todayIso();
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }, []);
  const grouped = items.reduce<Record<string, typeof items>>((accumulator, item) => {
    const key = item.date;
    accumulator[key] ??= [];
    accumulator[key].push(item);
    return accumulator;
  }, {});
  const todayCompleted = items.filter((item) => item.date === today && item.completed).length;
  const todayTotal = items.filter((item) => item.date === today).length || 1;
  const todayItems = items.filter((item) => item.date === today);
  const overdueItems = items.filter((item) => !item.completed && item.date < today);
  const upcomingItems = items
    .filter((item) => !item.completed && item.date > today)
    .slice()
    .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`))
    .slice(0, 6);
  const tomorrowItems = items
    .filter((item) => item.date === tomorrow)
    .slice()
    .sort((left, right) => left.time.localeCompare(right.time))
    .slice(0, 3);

  const generatePlan = useMutation({
    mutationFn: async () => {
      const response = await sendOpenClawCommand("jarvis", {
        message: [
          "Generate today's plan for Hamid in a strict machine-readable format.",
          "Return only lines in this exact format:",
          "HH:MM | Priority | Category | Task title",
          "Use Category from: Outreach, Build, Research, Personal, Family.",
          `Today's existing items: ${todayItems.map((item) => `${item.time} ${item.category} ${item.title}`).join("; ") || "none"}.`,
          "Produce between 4 and 8 lines for today only.",
        ].join("\n"),
      });
      return response.replyText;
    },
    onSuccess: (reply) => {
      setPlanReply(reply);
      const drafts = reply
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [time, priority, category, ...titleParts] = line.split("|").map((part) => part.trim());
          return {
            date: today,
            time,
            priority: (priority?.toLowerCase() === "high" ? "high" : priority?.toLowerCase() === "low" ? "low" : "medium") as "high" | "medium" | "low",
            category: (category === "Build" || category === "Research" || category === "Personal" || category === "Family" ? category : "Outreach") as "Outreach" | "Build" | "Research" | "Personal" | "Family",
            title: titleParts.join(" | "),
          };
        })
        .filter((draft) => /^\d{2}:\d{2}$/.test(draft.time) && draft.title);
      if (drafts.length) addItems(drafts);
    },
  });

  return (
    <>
      <PageWrapper
        eyebrow="Daily planner"
        title="A time-aware planner that keeps outreach, build work, and life in one clear rhythm."
        description="Every scheduled block can raise a browser reminder 15 minutes before and exactly on time."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="info">{items.length} scheduled blocks</Badge>
            <Button variant="ghost" onClick={() => generatePlan.mutate()} disabled={generatePlan.isPending}>
              Generate plan
            </Button>
            <Button variant="secondary" onClick={() => setComposerOpen(true)}>
              Add task
            </Button>
          </div>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Calendar strip</p>
                  <h2 className="display-title !text-[var(--text-lg)]">Today + next days</h2>
                </div>
                <Badge variant="neutral">{items.length} total tasks</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[0, 1, 2, 3].map((offset) => {
                  const day = new Date();
                  day.setDate(day.getDate() + offset);
                  const iso = day.toISOString().slice(0, 10);
                  const count = items.filter((item) => item.date === iso).length;
                  return (
                    <div
                      key={iso}
                      className={`rounded-[var(--radius-xl)] border p-4 ${offset === 0 ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_14%,var(--color-surface))]" : "border-[var(--color-border)] bg-[var(--color-surface-2)]"}`}
                    >
                      <p className="section-kicker">{offset === 0 ? "Today" : day.toLocaleDateString("en-GB", { weekday: "short" })}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{iso}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{count} scheduled</p>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Today</p>
                  <h2 className="display-title !text-[var(--text-lg)]">Completion status</h2>
                </div>
                <span className="metric-mono text-2xl font-semibold">
                  {todayCompleted}/{todayTotal}
                </span>
              </div>
              <Progress value={todayCompleted} max={todayTotal} label="Today's planner completion" />
            </Card>

            <Card className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Hour by hour</p>
                  <h2 className="display-title !text-[var(--text-lg)]">06:00–23:00 timeline</h2>
                </div>
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
                  <Clock3 size={18} className="text-[var(--color-accent)]" />
                </span>
              </div>
              <HourlyPlanner
                items={todayItems}
                onToggleComplete={toggleComplete}
              />
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Task pressure</p>
                  <h2 className="display-title !text-[var(--text-lg)]">Overdue + upcoming</h2>
                </div>
                <Badge variant={overdueItems.length ? "warning" : "success"}>
                  {overdueItems.length} overdue
                </Badge>
              </div>
              {overdueItems.length ? (
                <div className="space-y-3">
                  {overdueItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/6 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.date} · {item.time} · {item.category}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => toggleComplete(item.id)}>Done</Button>
                          <Button variant="danger" className="h-8 px-3 text-xs" onClick={() => removeItem(item.id)}>Remove</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-8">
                  <p className="section-kicker">No overdue tasks</p>
                  <p className="mt-2 body-copy text-sm">Execution rhythm is healthy — no missed blocks right now.</p>
                </div>
              )}
              {upcomingItems.length ? (
                <div className="space-y-3">
                  <p className="section-kicker">Next up</p>
                  {upcomingItems.map((item) => (
                    <div key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-[var(--color-text)]">{item.title}</span>
                        <span className="text-[var(--color-text-muted)]">{item.date} {item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>

            <Card className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-kicker">Tomorrow preview</p>
                  <h2 className="display-title !text-[var(--text-lg)]">{tomorrow}</h2>
                </div>
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
                  <CalendarDays size={18} className="text-[var(--color-accent)]" />
                </span>
              </div>
              {tomorrowItems.length ? (
                <div className="space-y-3">
                  {tomorrowItems.map((item) => (
                    <div key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.title}</p>
                        <Badge variant="info">{item.category}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-[var(--color-text-muted)]">{item.time}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-8">
                  <p className="section-kicker">No tasks yet</p>
                  <p className="mt-2 body-copy text-sm">
                    Tomorrow will preview here once you schedule the next blocks.
                  </p>
                </div>
              )}
            </Card>

            {Object.keys(grouped).length ? (
              <Card className="space-y-5">
                <div>
                  <p className="section-kicker">All scheduled days</p>
                  <h2 className="display-title !text-[var(--text-lg)]">Planner archive</h2>
                </div>
                <div className="space-y-3">
                  {Object.entries(grouped)
                    .sort(([left], [right]) => left.localeCompare(right))
                    .map(([date, dayItems]) => (
                      <div key={date} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{date}</p>
                          <Badge variant="neutral">{dayItems.length} items</Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          {dayItems.slice(0, 3).map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-[var(--color-text)]">{item.title}</span>
                              <span className="text-[var(--color-text-muted)]">{item.time}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            ) : null}

            {planReply ? (
              <Card className="space-y-4">
                <div>
                  <p className="section-kicker">Jarvis plan</p>
                  <h2 className="display-title !text-[var(--text-lg)]">Latest generated schedule</h2>
                </div>
                <pre className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm whitespace-pre-wrap text-[var(--color-text-muted)]">
                  {planReply}
                </pre>
              </Card>
            ) : null}
          </div>
        </div>
      </PageWrapper>

      <Modal
        open={composerOpen}
        title="Add a planner block"
        description="Planner items drive the live timeline, what's-next card, and browser reminder system."
        onClose={() => setComposerOpen(false)}
      >
        <ScheduleComposer onCreated={() => setComposerOpen(false)} />
      </Modal>
    </>
  );
}
