import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Copy,
  Globe,
  MessageSquare,
  Phone,
  Play,
  Square,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiUrl } from "@/services/api";

interface TunnelState {
  status: "stopped" | "starting" | "running" | "error";
  url: string | null;
  startedAt: string | null;
  twilioConfigured: boolean;
  elevenLabsConfigured: boolean;
  error: string | null;
}

async function fetchTunnelStatus(): Promise<TunnelState> {
  const res = await fetch(apiUrl("/api/tunnel/status"));
  if (!res.ok) throw new Error(`Tunnel API error: ${res.status}`);
  return res.json();
}

async function apiStartTunnel(): Promise<TunnelState> {
  const res = await fetch(apiUrl("/api/tunnel/start"), { method: "POST" });
  return res.json() as Promise<TunnelState>;
}

async function apiStopTunnel(): Promise<void> {
  await fetch(apiUrl("/api/tunnel/stop"), { method: "POST" });
}

export function TunnelPage() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: tunnel } = useQuery<TunnelState>({
    queryKey: ["tunnel-status"],
    queryFn: fetchTunnelStatus,
    refetchInterval: 5000,
  });

  const startMutation = useMutation({
    mutationFn: apiStartTunnel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tunnel-status"] }),
  });

  const stopMutation = useMutation({
    mutationFn: apiStopTunnel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tunnel-status"] }),
  });

  const isRunning = tunnel?.status === "running";
  const isStarting = tunnel?.status === "starting" || startMutation.isPending;

  const copy = () => {
    if (tunnel?.url) {
      void navigator.clipboard.writeText(tunnel.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const statusVariant = {
    running: "success",
    starting: "warning",
    stopped: "neutral",
    error: "error",
  } as const;

  const webhooks = [
    { label: "Twilio Voice URL", path: "/api/calls/twiml", icon: Phone, ok: isRunning && (tunnel?.twilioConfigured ?? false) },
    { label: "Twilio SMS Webhook", path: "/api/sms/webhook", icon: MessageSquare, ok: isRunning && (tunnel?.twilioConfigured ?? false) },
    { label: "Twilio Status Callback", path: "/api/calls/status", icon: Phone, ok: isRunning && (tunnel?.twilioConfigured ?? false) },
    { label: "ElevenLabs Post-Call", path: "/api/voice/elevenlabs/post-call", icon: Zap, ok: isRunning && (tunnel?.elevenLabsConfigured ?? false) },
  ];

  return (
    <PageWrapper eyebrow="HAMID.OS · OPS" title="TUNNEL & WEBHOOKS" description="Public URL management and auto-configuration for Twilio + ElevenLabs">
      <div className="space-y-6 max-w-4xl">

        {/* Tunnel Status */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
                <Globe size={16} className="text-[var(--color-accent)]" />
              </div>
              <div>
                <h2 className="font-semibold">Cloudflare Tunnel</h2>
                <p className="text-xs text-[var(--color-text-muted)]">Exposes localhost:3007 publicly for Twilio callbacks</p>
              </div>
            </div>
            <Badge variant={statusVariant[tunnel?.status ?? "stopped"]}>
              {(tunnel?.status ?? "STOPPED").toUpperCase()}
            </Badge>
          </div>

          {tunnel?.url && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-[var(--color-surface-2)] font-mono text-sm border border-[var(--color-border)]">
              <span className="flex-1 text-[var(--color-accent)] truncate">{tunnel.url}</span>
              <button onClick={copy} className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                <Copy size={14} />
              </button>
              {copied && <span className="text-xs text-green-400 shrink-0">Copied!</span>}
            </div>
          )}

          {tunnel?.error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              ⚠ {tunnel.error}
            </div>
          )}

          {tunnel?.startedAt && (
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              Started: {new Date(tunnel.startedAt).toLocaleString("en-GB")}
            </p>
          )}

          <div className="flex gap-3">
            {!isRunning ? (
              <Button onClick={() => startMutation.mutate()} disabled={isStarting}>
                <Play size={14} className="mr-2" />
                {isStarting ? "Starting tunnel…" : "Start Tunnel"}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => stopMutation.mutate()}>
                <Square size={14} className="mr-2" />
                Stop Tunnel
              </Button>
            )}
          </div>
        </Card>

        {/* Webhook Status */}
        <Card className="p-6">
          <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
            <Zap size={16} className="text-[var(--color-accent)]" />
            Webhook Configuration
          </h2>
          <div className="space-y-0">
            {webhooks.map(({ label, path, icon: Icon, ok }) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0">
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-[var(--color-text-muted)]" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[var(--color-text-muted)] max-w-64 truncate">
                    {tunnel?.url ? `${tunnel.url}${path}` : path}
                  </span>
                  {ok
                    ? <CheckCircle size={14} className="text-green-400 shrink-0" />
                    : <XCircle size={14} className="text-[var(--color-text-muted)] shrink-0" />
                  }
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Setup Instructions */}
        {!isRunning && (
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Setup Instructions</h2>
            <ol className="space-y-3 text-sm text-[var(--color-text-muted)]">
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] font-bold shrink-0">1.</span>
                <span>Install cloudflared: <code className="bg-[var(--color-surface-2)] px-2 py-0.5 rounded text-xs font-mono">brew install cloudflared</code></span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] font-bold shrink-0">2.</span>
                <span>Set env vars: <code className="bg-[var(--color-surface-2)] px-2 py-0.5 rounded text-xs font-mono">TWILIO_PHONE_NUMBER</code> for webhook auto-config</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] font-bold shrink-0">3.</span>
                <span>Click <strong>Start Tunnel</strong> — a public HTTPS URL is generated instantly (no account needed)</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] font-bold shrink-0">4.</span>
                <span>Twilio phone number webhooks are auto-configured for voice + SMS</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] font-bold shrink-0">5.</span>
                <span>ElevenLabs agent <code className="bg-[var(--color-surface-2)] px-1 rounded text-xs font-mono">agent_1201kp6qhf3zfz9actd3d8k7dv1q</code> post-call webhook is auto-set</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-accent)] font-bold shrink-0">6.</span>
                <span>Inbound calls + SMS will flow into your CRM automatically in real-time</span>
              </li>
            </ol>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
