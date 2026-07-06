import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  CheckCircle,
  CreditCard,
  Database,
  ExternalLink,
  Globe,
  Landmark,
  Mail,
  RefreshCw,
  Shield,
  Smartphone,
  Sparkles,
  Store,
  Waves,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiUrl, fetchIntegrationsStatus, syncIntegration } from "@/services/api";
import type { IntegrationConnector } from "@/types/frontend";

interface ServiceStatus {
  connected: boolean;
  label: string;
  enables: string;
}

interface TunnelState {
  status: "stopped" | "starting" | "running" | "error";
  url: string | null;
  startedAt: string | null;
  twilioConfigured: boolean;
  elevenLabsConfigured: boolean;
  error: string | null;
}

interface HealthResponse {
  services: Record<string, ServiceStatus>;
  tunnel: TunnelState;
  version: string;
  uptime: number;
}

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(apiUrl("/api/system/health"));
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSyncedAt(value: string | null): string {
  if (!value) return "Never synced";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Unknown sync";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const CONNECTOR_ICONS: Record<string, typeof Database> = {
  gmail: Mail,
  apify: Database,
  firecrawl: Sparkles,
  plaid: Landmark,
  stripe: CreditCard,
  revenuecat: Smartphone,
  appstore: Store,
  twilio: Waves,
  elevenlabs: Bot,
  kie: Sparkles,
  openclaw: Shield,
};

const SYNCABLE = new Set(["gmail", "plaid", "revenuecat", "appstore"]);

export function SystemHealthPage() {
  const queryClient = useQueryClient();
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);

  const healthQuery = useQuery<HealthResponse>({
    queryKey: ["system-health"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
    retry: 2,
  });

  const integrationsQuery = useQuery({
    queryKey: ["integrations-status"],
    queryFn: fetchIntegrationsStatus,
    refetchInterval: 20_000,
    retry: 1,
  });

  const syncMutation = useMutation({
    mutationFn: (provider?: "gmail" | "plaid" | "revenuecat" | "appstore") => syncIntegration(provider),
    onSuccess: async (result) => {
      setLastSyncMessage(`${result.results.length} connector sync attempt${result.results.length === 1 ? "" : "s"} logged.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integrations-status"] }),
        queryClient.invalidateQueries({ queryKey: ["system-health"] }),
      ]);
    },
  });

  const connectors = integrationsQuery.data?.connectors ?? [];
  const connectedCount = connectors.filter((connector) => connector.connected).length;
  const syncableConnected = connectors.filter((connector) => connector.connected && SYNCABLE.has(connector.provider)).length;
  const missingConnectors = connectors.filter((connector) => !connector.connected);

  const topSignals = useMemo(() => {
    const errors = connectors.filter((connector) => connector.status === "error");
    if (errors.length > 0) return `${errors.length} connector${errors.length === 1 ? "" : "s"} need attention`;
    if (missingConnectors.length > 0) return `${missingConnectors.length} connector${missingConnectors.length === 1 ? "" : "s"} need API keys`;
    return "All connector keys are present";
  }, [connectors, missingConnectors.length]);

  return (
    <PageWrapper
      eyebrow="HAMID.OS · CONNECTORS"
      title="Live API control plane."
      description="Gmail, Apify, Firecrawl, Plaid, Stripe, RevenueCat, App Store Connect, Twilio, ElevenLabs, KIE, and OpenClaw status with persistent sync snapshots."
      actions={
        <>
          <Button
            variant="secondary"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate(undefined)}
          >
            <RefreshCw size={16} />
            Sync live data
          </Button>
          <a href="#/ops/tunnel">
            <Button variant="secondary">
              <Globe size={16} />
              Tunnel
            </Button>
          </a>
        </>
      }
    >
      <div className="space-y-6">
        {healthQuery.error && (
          <div className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400">
            <XCircle size={15} />
            <span className="text-sm">Cannot connect to HAMID.OS server. Make sure the dashboard server is running on port 3007.</span>
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-4">
          <Card className="p-5">
            <p className="section-kicker">Connected</p>
            <p className="metric-mono mt-3 text-3xl font-semibold">{connectedCount}/{connectors.length || 11}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">API keys and live credentials present</p>
          </Card>
          <Card className="p-5">
            <p className="section-kicker">Syncable live feeds</p>
            <p className="metric-mono mt-3 text-3xl font-semibold text-[var(--color-accent)]">{syncableConnected}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Gmail, Plaid, RevenueCat, App Store</p>
          </Card>
          <Card className="p-5">
            <p className="section-kicker">Runtime</p>
            <p className="metric-mono mt-3 text-3xl font-semibold">
              {healthQuery.data ? formatUptime(healthQuery.data.uptime) : "—"}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{healthQuery.data?.version ?? "HAMID.OS"}</p>
          </Card>
          <Card className="p-5">
            <p className="section-kicker">Signal</p>
            <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{topSignals}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{lastSyncMessage ?? "No manual sync this session"}</p>
          </Card>
        </section>

        {healthQuery.data?.tunnel && (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Globe size={16} className="text-[var(--color-accent)]" />
              <span className="text-sm font-medium">Public Tunnel</span>
              <Badge variant={healthQuery.data.tunnel.status === "running" ? "success" : "neutral"}>
                {healthQuery.data.tunnel.status}
              </Badge>
              {healthQuery.data.tunnel.url && (
                <span className="font-mono text-xs text-[var(--color-text-muted)]">{healthQuery.data.tunnel.url}</span>
              )}
              <a href="#/ops/tunnel" className="ml-auto text-xs text-[var(--color-accent)] hover:underline">
                Manage tunnel
              </a>
            </div>
          </Card>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {integrationsQuery.isLoading ? (
            Array.from({ length: 9 }, (_, index) => (
              <Card key={index} className="h-52 animate-pulse p-5">
                <div className="h-4 w-2/3 rounded bg-[var(--color-surface-2)]" />
                <div className="mt-4 h-16 rounded bg-[var(--color-surface-2)]" />
              </Card>
            ))
          ) : connectors.map((connector: IntegrationConnector) => {
            const Icon = CONNECTOR_ICONS[connector.provider] ?? Database;
            const canSync = SYNCABLE.has(connector.provider);

            return (
              <Card
                key={connector.provider}
                className={`p-5 ${connector.status === "error" ? "border-red-500/30" : connector.connected ? "border-green-500/20" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-10 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)]">
                      <Icon size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{connector.label}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{formatSyncedAt(connector.syncedAt)}</p>
                    </div>
                  </div>
                  {connector.connected ? (
                    <CheckCircle size={17} className="text-green-400" />
                  ) : (
                    <XCircle size={17} className="text-red-400/70" />
                  )}
                </div>

                <p className="mt-4 min-h-10 text-xs leading-5 text-[var(--color-text-muted)]">{connector.enables}</p>

                {connector.missingEnv.length > 0 && (
                  <div className="mt-4 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
                    <p className="section-kicker !text-[9px]">Missing env</p>
                    <p className="mt-2 text-[11px] leading-5 text-[var(--color-text-muted)]">{connector.missingEnv.join(", ")}</p>
                  </div>
                )}

                {connector.error && (
                  <details className="mt-3 rounded-[12px] border border-[color-mix(in_oklab,var(--color-error)_35%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-error)_6%,var(--color-surface))] px-3 py-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-[var(--color-error)]">
                      Error details
                    </summary>
                    <p className="mt-2 break-words text-[11px] leading-[1.5] text-[var(--color-error)]">
                      {connector.error}
                    </p>
                  </details>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {canSync ? (
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 text-xs"
                      disabled={syncMutation.isPending}
                      onClick={() => syncMutation.mutate(connector.provider as "gmail" | "plaid" | "revenuecat" | "appstore")}
                    >
                      <RefreshCw size={13} />
                      Sync
                    </Button>
                  ) : null}
                  <a href={connector.setupUrl} target="_blank" rel="noreferrer">
                    <Button variant="ghost" className="min-h-9 px-3 text-xs">
                      <ExternalLink size={13} />
                      Setup
                    </Button>
                  </a>
                </div>
              </Card>
            );
          })}
        </section>

        <Card className="p-6">
          <div className="flex items-start gap-3">
            <Activity size={18} className="mt-1 text-[var(--color-accent)]" />
            <div>
              <p className="text-sm font-semibold">Persistence rule</p>
              <p className="mt-1 text-xs leading-6 text-[var(--color-text-muted)]">
                Every live sync writes a snapshot into SQLite, then the dashboard reads from those snapshots. That means the system can show the latest known data even if an API is temporarily down.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
}
