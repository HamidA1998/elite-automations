import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, Save, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiUrl } from "@/services/api";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
}

async function fetchTemplates(): Promise<EmailTemplate[]> {
  const res = await fetch(apiUrl("/api/mail/templates"));
  if (!res.ok) throw new Error("Failed to load templates");
  return res.json();
}

export function TemplatesPage() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["mail-templates"],
    queryFn: fetchTemplates,
    staleTime: 30_000,
  });

  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", subject: "", body: "" });

  const saveMut = useMutation({
    mutationFn: async (t: { id?: string; name: string; subject: string; body: string }) => {
      const res = await fetch(apiUrl(t.id ? `/api/mail/templates/${t.id}` : "/api/mail/templates"), {
        method: t.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mail-templates"] });
      setEditing(null);
      setCreating(false);
      setDraft({ name: "", subject: "", body: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await fetch(apiUrl(`/api/mail/templates/${id}`), { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mail-templates"] }),
  });

  function startEdit(t: EmailTemplate) {
    setEditing(t);
    setDraft({ name: t.name, subject: t.subject, body: t.body });
    setCreating(false);
  }

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setDraft({ name: "", subject: "", body: "" });
  }

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-kicker">Mail</p>
          <h1 className="display-title mt-2">Templates</h1>
        </div>
        <Button variant="primary" onClick={startCreate}>
          <Plus size={15} /> New template
        </Button>
      </div>

      {/* Editor */}
      {(creating || editing) && (
        <div className="glass-panel rounded-[var(--radius-2xl)] p-6 space-y-4 border border-[var(--color-accent)]/30">
          <p className="font-semibold text-[var(--color-text)]">{creating ? "New template" : `Edit: ${editing!.name}`}</p>
          <input
            placeholder="Template name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
          <input
            placeholder="Subject line"
            value={draft.subject}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          />
          <textarea
            rows={8}
            placeholder="Email body…"
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xl)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 resize-none font-mono"
          />
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => saveMut.mutate({ id: editing?.id, ...draft })}
              disabled={saveMut.isPending || !draft.name || !draft.subject || !draft.body}
            >
              <Save size={14} /> Save
            </Button>
            <Button variant="secondary" onClick={() => { setEditing(null); setCreating(false); }}>
              <X size={14} /> Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-[var(--radius-2xl)] animate-pulse bg-[var(--color-surface-2)]" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="glass-panel rounded-[var(--radius-2xl)] py-16 flex flex-col items-center text-center text-[var(--color-text-muted)]">
          <FileText size={36} className="mb-3 opacity-30" />
          <p className="text-sm">No templates yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="glass-panel rounded-[var(--radius-2xl)] p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[var(--color-text)]">{t.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{t.subject}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => startEdit(t)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => deleteMut.mutate(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] line-clamp-3 font-mono leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
