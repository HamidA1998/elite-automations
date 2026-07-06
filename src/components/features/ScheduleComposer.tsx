import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ScheduleCategory, SchedulePriority } from "@/types/frontend";
import { useScheduleStore } from "@/stores/schedule-store";

const categories: ScheduleCategory[] = ["Outreach", "Build", "Research", "Personal", "Family"];
const priorities: SchedulePriority[] = ["high", "medium", "low"];

export function ScheduleComposer({ onCreated }: { onCreated?: () => void }) {
  const addItem = useScheduleStore((state) => state.addItem);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState({
    title: "",
    date: today,
    time: "09:00",
    priority: "medium" as SchedulePriority,
    category: "Outreach" as ScheduleCategory,
  });

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!form.title.trim()) return;
        addItem(form);
        onCreated?.();
      }}
    >
      <div className="md:col-span-2">
        <Input
          label="Title"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          placeholder="Call three roofing companies in Rochdale"
          required
        />
      </div>
      <Input
        label="Date"
        type="date"
        value={form.date}
        onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
      />
      <Input
        label="Time"
        type="time"
        value={form.time}
        onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
      />
      <label className="flex flex-col gap-2">
        <span className="section-kicker">Priority</span>
        <select
          value={form.priority}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              priority: event.target.value as SchedulePriority,
            }))
          }
          className="min-h-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4"
        >
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2">
        <span className="section-kicker">Category</span>
        <select
          value={form.category}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              category: event.target.value as ScheduleCategory,
            }))
          }
          className="min-h-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4"
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit">Add schedule item</Button>
      </div>
    </form>
  );
}
