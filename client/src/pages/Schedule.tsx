import { useState } from "react";
import { useScheduleStore, useDailyProgress } from "@/stores/scheduleStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Progress } from "@/components/ui/Progress";
import type { ScheduleItem } from "@/types";
import {
  Plus, CheckCircle2, Circle, Clock, Trash2,
  CalendarDays, Zap, Flag, AlarmClock, ChevronRight,
} from "lucide-react";

const PRIORITY_COLORS = {
  low: "text-[var(--color-text-muted)] border-[var(--color-border)]",
  medium: "text-blue-400 border-blue-400/30",
  high: "text-amber-400 border-amber-400/30",
  critical: "text-red-400 border-red-400/30",
};

const PRIORITY_BG = {
  low: "",
  medium: "bg-blue-400/5",
  high: "bg-amber-400/5",
  critical: "bg-red-400/5",
};

type NewItem = Omit<ScheduleItem, "id" | "completed">;

function AddItemModal({ onClose, onAdd }: { onClose: () => void; onAdd: (item: NewItem) => void }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [priority, setPriority] = useState<ScheduleItem["priority"]>("medium");
  const [category, setCategory] = useState<ScheduleItem["category"]>("focus");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!title.trim() || !time) return;
    onAdd({ title, time, duration, priority, category, notes: notes || undefined });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Add Schedule Item" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Morning outreach…"
            className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Time *</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Duration (min)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              min={5} max={480} step={5}
              className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ScheduleItem["priority"])}
              className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ScheduleItem["category"])}
              className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="outreach">Outreach</option>
              <option value="follow_up">Follow Up</option>
              <option value="meeting">Meeting</option>
              <option value="admin">Admin</option>
              <option value="focus">Focus</option>
              <option value="review">Review</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={!title.trim() || !time}>
            Add Item
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  outreach: "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
  follow_up: "bg-amber-400/15 text-amber-400",
  meeting: "bg-emerald-400/15 text-emerald-400",
  admin: "bg-slate-400/15 text-slate-400",
  focus: "bg-purple-400/15 text-purple-400",
  review: "bg-cyan-400/15 text-cyan-400",
};

function TimelineItem({ item, onToggle, onDelete }: {
  item: ScheduleItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`flex gap-4 group ${item.completed ? "opacity-60" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Time column */}
      <div className="w-16 flex-shrink-0 text-right">
        <span className="font-mono text-sm text-[var(--color-text-muted)]">{item.time}</span>
      </div>

      {/* Connector */}
      <div className="relative flex flex-col items-center w-4 flex-shrink-0">
        <button
          onClick={() => onToggle(item.id)}
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0 mt-0.5 z-10
            ${item.completed
              ? "bg-emerald-500 border-emerald-500"
              : "border-[var(--color-border-strong)] bg-[var(--color-bg)] hover:border-[var(--color-accent)]"
            }`}
        >
          {item.completed && <CheckCircle2 size={10} className="text-white" />}
        </button>
        <div className="flex-1 w-px bg-[var(--color-border)] mt-1" />
      </div>

      {/* Card */}
      <div className={`flex-1 mb-4 rounded-xl border p-4 transition-all duration-200
        ${PRIORITY_COLORS[item.priority] || "border-[var(--color-border)]"}
        ${PRIORITY_BG[item.priority] || ""}
        bg-[var(--color-surface)] hover:border-opacity-60`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-semibold ${item.completed ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text)]"}`}>
                {item.title}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category] ?? "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"}`}>
                {item.category.replace(/_/g, " ")}
              </span>
            </div>
            {item.notes && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">{item.notes}</p>
            )}
            {item.duration && (
              <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mt-1.5">
                <Clock size={10} />
                {item.duration >= 60
                  ? `${Math.floor(item.duration / 60)}h ${item.duration % 60 > 0 ? `${item.duration % 60}m` : ""}`
                  : `${item.duration}m`}
              </div>
            )}
          </div>
          {hovered && (
            <button
              onClick={() => onDelete(item.id)}
              className="ml-2 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Schedule() {
  const { items, addItem, toggleItem, removeItem } = useScheduleStore();
  const { completed, total, streak } = useDailyProgress();
  const [showAdd, setShowAdd] = useState(false);

  const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const currentItem = sorted.find((item) => {
    if (item.completed) return false;
    const [h, m] = item.time.split(":").map(Number);
    const start = h * 60 + m;
    const end = start + (item.duration ?? 60);
    return nowMins >= start && nowMins < end;
  });

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Daily Schedule</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} className="mr-1.5" /> Add Item
        </Button>
      </div>

      {/* Progress strip */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-[var(--color-accent)]" />
            <span className="text-sm font-semibold text-[var(--color-text)]">{completed}/{total} tasks done</span>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && (
              <div className="flex items-center gap-1 text-xs text-amber-400 font-mono">
                <Zap size={12} fill="currentColor" /> {streak}d streak
              </div>
            )}
            <span className="text-sm font-bold font-mono text-[var(--color-accent)]">{pct}%</span>
          </div>
        </div>
        <Progress value={completed} max={total || 1} variant="accent" size="lg" />

        {currentItem && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center gap-3">
            <AlarmClock size={14} className="text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-xs text-[var(--color-text-muted)]">Currently active</div>
              <div className="text-sm font-semibold text-[var(--color-text)]">{currentItem.title}</div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <CalendarDays size={40} className="text-[var(--color-text-muted)]" />
            <p className="text-[var(--color-text-muted)] text-sm">No items scheduled. Add your first task!</p>
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={13} className="mr-1" /> Add Item
            </Button>
          </div>
        ) : (
          <div>
            {sorted.map((item) => (
              <TimelineItem
                key={item.id}
                item={item}
                onToggle={toggleItem}
                onDelete={removeItem}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddItemModal onClose={() => setShowAdd(false)} onAdd={addItem} />
      )}
    </div>
  );
}
