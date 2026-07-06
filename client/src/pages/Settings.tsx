import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { Button } from "@/components/ui/Button";
import { api } from "@/services/api";
import type { TimeTheme } from "@/types";
import {
  Moon, Sun, Sunset, Sunrise, Palette, Bell, Key,
  Download, Database, Save, Check, AlertTriangle,
  RefreshCw, Eye, EyeOff,
} from "lucide-react";

const THEMES: { key: TimeTheme; label: string; icon: React.ReactNode; description: string }[] = [
  { key: "dawn",  label: "Dawn",  icon: <Sunrise size={16} />,  description: "Warm amber & blush" },
  { key: "day",   label: "Day",   icon: <Sun size={16} />,      description: "Clean cool whites" },
  { key: "dusk",  label: "Dusk",  icon: <Sunset size={16} />,   description: "Warm orange glow" },
  { key: "night", label: "Night", icon: <Moon size={16} />,     description: "Deep indigo dark" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
      <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
      {children}
    </div>
  );
}

function ThemeSelector() {
  const { manualTheme, setManualTheme } = useAppStore();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {THEMES.map(({ key, label, icon, description }) => (
          <button
            key={key}
            onClick={() => setManualTheme(manualTheme === key ? null : key)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200
              ${manualTheme === key
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
              }`}
          >
            {icon}
            <span className="text-xs font-semibold">{label}</span>
            <span className="text-xs opacity-70">{description}</span>
          </button>
        ))}
      </div>
      {manualTheme && (
        <button
          onClick={() => setManualTheme(null)}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline transition-colors"
        >
          Reset to auto (time-of-day)
        </button>
      )}
      {!manualTheme && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Theme is currently <strong className="text-[var(--color-text)]">automatic</strong> — it changes based on time of day.
        </p>
      )}
    </div>
  );
}

function EnvVarField({ label, envKey, description, secret = false }: {
  label: string;
  envKey: string;
  description: string;
  secret?: boolean;
}) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    // In production this would call an API to update the .env file
    // For now we just give feedback
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[var(--color-text)]">{label}</label>
      <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={secret && !show ? "password" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Enter ${envKey}…`}
            className="w-full h-10 px-3 pr-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] font-mono transition-colors"
          />
          {secret && (
            <button
              onClick={() => setShow(!show)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>
        <Button
          variant={saved ? "secondary" : "ghost"}
          size="sm"
          onClick={save}
          className="flex-shrink-0"
        >
          {saved ? <Check size={14} className="text-emerald-400" /> : <Save size={14} />}
        </Button>
      </div>
    </div>
  );
}

function DataManagement() {
  const [backingUp, setBackingUp] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { setState, setLoading } = useAppStore();

  const backup = async () => {
    setBackingUp(true);
    setBackupMsg(null);
    try {
      const res = await api.backup();
      setBackupMsg(`Backed up to: ${res.path}`);
    } catch (e: any) {
      setBackupMsg(`Error: ${e.message}`);
    } finally {
      setBackingUp(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `elite-automations-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ } finally {
      setExporting(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await api.getState();
      setState(s);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="sm" onClick={backup} loading={backingUp}>
          <Database size={14} className="mr-1.5" /> Backup Database
        </Button>
        <Button variant="secondary" size="sm" onClick={exportCsv} loading={exporting}>
          <Download size={14} className="mr-1.5" /> Export CSV
        </Button>
        <Button variant="ghost" size="sm" onClick={refresh}>
          <RefreshCw size={14} className="mr-1.5" /> Refresh Data
        </Button>
      </div>
      {backupMsg && (
        <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2
          ${backupMsg.startsWith("Error")
            ? "bg-red-400/10 text-red-400 border border-red-400/30"
            : "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30"
          }`}>
          {backupMsg.startsWith("Error") ? <AlertTriangle size={12} /> : <Check size={12} />}
          {backupMsg}
        </div>
      )}
    </div>
  );
}

function SidebarSettings() {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-[var(--color-text)]">Collapse Sidebar by Default</div>
        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Saves screen space on smaller displays</div>
      </div>
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className={`relative w-10 h-6 rounded-full transition-colors duration-200
          ${sidebarCollapsed ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-strong)]"}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200
          ${sidebarCollapsed ? "translate-x-4" : ""}`}
        />
      </button>
    </div>
  );
}

export function Settings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">Settings</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Configure your Elite Automations workspace</p>
      </div>

      {/* Appearance */}
      <Section title="Appearance">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Palette size={14} className="text-[var(--color-accent)]" />
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Theme</span>
          </div>
          <ThemeSelector />
        </div>
        <div className="pt-4 border-t border-[var(--color-border)]">
          <SidebarSettings />
        </div>
      </Section>

      {/* API Keys */}
      <Section title="API Keys">
        <div className="flex items-center gap-2 mb-1">
          <Key size={14} className="text-[var(--color-accent)]" />
          <span className="text-xs text-[var(--color-text-muted)]">
            Keys are stored in your <code className="font-mono bg-[var(--color-surface-2)] px-1 py-0.5 rounded">.env</code> file and never sent to the client.
          </span>
        </div>
        <div className="space-y-5 pt-2">
          <EnvVarField
            label="Firecrawl API Key"
            envKey="FIRECRAWL_API_KEY"
            description="Used to discover and scrape business websites for lead enrichment."
            secret
          />
          <EnvVarField
            label="KIE API Key"
            envKey="KIE_API_KEY"
            description="Generates visual brand analysis images for lead demos."
            secret
          />
          <EnvVarField
            label="OpenClaw Gateway URL"
            envKey="OPENCLAW_GATEWAY_URL"
            description="Local OpenClaw agent gateway (e.g. http://127.0.0.1:18789)"
          />
          <EnvVarField
            label="OpenClaw API Token"
            envKey="OPENCLAW_API_TOKEN"
            description="Authentication token for the OpenClaw REST API."
            secret
          />
        </div>
      </Section>

      {/* Data management */}
      <Section title="Data Management">
        <div className="flex items-center gap-2 mb-2">
          <Database size={14} className="text-[var(--color-accent)]" />
          <span className="text-xs text-[var(--color-text-muted)]">
            SQLite database stored in <code className="font-mono bg-[var(--color-surface-2)] px-1 py-0.5 rounded">output/elite-ops.db</code>
          </span>
        </div>
        <DataManagement />
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={14} className="text-[var(--color-accent)]" />
          <span className="text-xs text-[var(--color-text-muted)]">Schedule reminders use browser notifications (requires permission)</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if ("Notification" in window) {
              Notification.requestPermission().then((perm) => {
                alert(`Notification permission: ${perm}`);
              });
            }
          }}
        >
          <Bell size={14} className="mr-1.5" /> Request Notification Permission
        </Button>
      </Section>

      {/* About */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-6 py-4">
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text)]">Elite Automations</span>
          <span className="font-mono">v3.0.0</span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Enterprise lead generation & outreach intelligence platform.
        </p>
      </div>
    </div>
  );
}
