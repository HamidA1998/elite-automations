import { Bell, CreditCard, ImageIcon, KeyRound, MoonStar, Search, ShieldCheck, Zap } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useSettingsStore } from "@/stores/settings-store";
import type { ThemeMode } from "@/types/frontend";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDashboardState, fetchIntegrationsStatus, syncIntegration } from "@/services/api";

export interface SettingsPageProps {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  notificationPermission: NotificationPermission | "unsupported";
  onEnableNotifications: () => void;
}

export function SettingsPage({
  themeMode,
  onThemeModeChange,
  notificationPermission,
  onEnableNotifications,
}: SettingsPageProps) {
  const queryClient = useQueryClient();
  const stateQuery = useQuery({ queryKey: ["dashboard-state"], queryFn: fetchDashboardState });
  const integrationsQuery = useQuery({
    queryKey: ["integrations-status"],
    queryFn: fetchIntegrationsStatus,
    staleTime: 20_000,
  });
  const apiKeys = useSettingsStore((state) => state.apiKeys);
  const notificationPreferences = useSettingsStore((state) => state.notificationPreferences);
  const businessProfile = useSettingsStore((state) => state.businessProfile);
  const setApiKey = useSettingsStore((state) => state.setApiKey);
  const setNotificationPreference = useSettingsStore((state) => state.setNotificationPreference);
  const setBusinessProfileField = useSettingsStore((state) => state.setBusinessProfileField);
  const connectorSync = useMutation({
    mutationFn: async (provider?: "gmail" | "plaid" | "revenuecat" | "appstore") =>
      syncIntegration(provider),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-state"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-status"] }),
      ]);
    },
  });

  return (
    <PageWrapper
      eyebrow="System settings"
      title="Control the operating environment, not just the visuals."
      description="Theme behaviour, reminder permissions, and core business identity settings live here first so the rest of the system can inherit them cleanly."
    >
      {/* Live connection status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        {[
          { label: "Stripe",     icon: CreditCard, ok: stateQuery.data?.sync.stripeConnectorReady ?? false,    detail: "Live payments" },
          { label: "Firecrawl",  icon: Search,     ok: Boolean(apiKeys.firecrawlApiKey),                       detail: "Web scraping" },
          { label: "KIE.ai",     icon: ImageIcon,  ok: Boolean(apiKeys.kieApiKey),                             detail: "Image gen" },
          { label: "H/OS",       icon: Zap,        ok: !stateQuery.isLoading && !stateQuery.isError,           detail: "Backend" },
        ].map(({ label, icon: Icon, ok, detail }) => (
          <div key={label} className="glass-panel rounded-[var(--radius-xl)] p-4 flex items-center gap-3">
            <span className={`inline-flex size-9 items-center justify-center rounded-full shrink-0 ${ok ? "bg-green-500/15 text-green-400" : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"}`}>
              <Icon size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--color-text)]">{label}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{ok ? "✓ " + detail : "Not connected"}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
              <KeyRound size={18} className="text-[var(--color-accent)]" />
            </span>
            <div>
              <p className="section-kicker">API keys</p>
              <h2 className="display-title !text-[var(--text-lg)]">Local workspace vault</h2>
            </div>
          </div>
          <div className="grid gap-4">
            <Input
              label="Firecrawl API key"
              type="password"
              value={apiKeys.firecrawlApiKey}
              onChange={(event) => setApiKey("firecrawlApiKey", event.target.value)}
              placeholder="fc-..."
            />
            <Input
              label="KIE API key"
              type="password"
              value={apiKeys.kieApiKey}
              onChange={(event) => setApiKey("kieApiKey", event.target.value)}
              placeholder="kie-..."
            />
            <p className="text-sm text-[var(--color-text-muted)]">
              Keys stored here are browser-local for the Phase 2 frontend. The existing backend env
              remains the live source for server jobs.
            </p>
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
              <Zap size={18} className="text-[var(--color-accent)]" />
            </span>
            <div>
              <p className="section-kicker">Live integrations</p>
              <h2 className="display-title !text-[var(--text-lg)]">Connection orchestration</h2>
            </div>
          </div>
          <div className="space-y-3">
            {(integrationsQuery.data?.connectors ?? []).map((connector) => (
              <div key={connector.provider} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="section-kicker">{connector.label}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{connector.enables}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      connector.connected
                        ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                        : connector.status === "error"
                          ? "bg-[var(--color-error)]/15 text-[var(--color-error)]"
                          : "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
                    }`}
                  >
                    {connector.connected ? "Connected" : connector.status === "error" ? "Error" : "Setup required"}
                  </span>
                </div>
                {connector.error ? (
                  <p className="mt-2 text-xs text-[var(--color-error)]">{connector.error}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    className="h-9 px-3 text-xs"
                    onClick={() => connectorSync.mutate(connector.provider as "gmail" | "plaid" | "revenuecat" | "appstore")}
                    disabled={connectorSync.isPending}
                  >
                    Sync {connector.label}
                  </Button>
                  {connector.setupUrl ? (
                    <a
                      href={connector.setupUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                    >
                      Setup docs
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
            {!integrationsQuery.data?.connectors?.length ? (
              <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-8">
                <p className="section-kicker">No connector telemetry</p>
                <p className="mt-2 body-copy text-sm">
                  Connector status will appear here once the backend reports integration metadata.
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
              <MoonStar size={18} className="text-[var(--color-accent)]" />
            </span>
            <div>
              <p className="section-kicker">Theme system</p>
              <h2 className="display-title !text-[var(--text-lg)]">Automatic time modes</h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["auto", "dawn", "day", "dusk", "night"] as ThemeMode[]).map((mode) => (
              <Button
                key={mode}
                variant={themeMode === mode ? "primary" : "secondary"}
                onClick={() => onThemeModeChange(mode)}
                className="justify-start"
              >
                {mode}
              </Button>
            ))}
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
              <Bell size={18} className="text-[var(--color-accent)]" />
            </span>
            <div>
              <p className="section-kicker">Notifications</p>
              <h2 className="display-title !text-[var(--text-lg)]">Planner reminders</h2>
            </div>
          </div>
          <p className="body-copy text-sm">
            Permission status: <strong className="text-[var(--color-text)]">{notificationPermission}</strong>
          </p>
          <Button onClick={onEnableNotifications}>Enable browser notifications</Button>
          <div className="grid gap-3">
            <Switch
              checked={notificationPreferences.fifteenMinuteWarning}
              onChange={(value) => setNotificationPreference("fifteenMinuteWarning", value)}
              label="15-minute warning"
              description="Remind before each scheduled item."
            />
            <Switch
              checked={notificationPreferences.onTimeReminder}
              onChange={(value) => setNotificationPreference("onTimeReminder", value)}
              label="At-time reminder"
              description="Notify exactly when a block starts."
            />
            <Switch
              checked={notificationPreferences.endOfDaySummary}
              onChange={(value) => setNotificationPreference("endOfDaySummary", value)}
              label="End-of-day summary"
              description="Keep a daily completion prompt ready for the later AI layer."
            />
          </div>
        </Card>

        <Card className="space-y-5 xl:col-span-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
              <ShieldCheck size={18} className="text-[var(--color-accent)]" />
            </span>
            <div>
              <p className="section-kicker">Business profile</p>
              <h2 className="display-title !text-[var(--text-lg)]">Identity inherited by demos and outreach</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Owner name"
              value={businessProfile.ownerName}
              onChange={(event) => setBusinessProfileField("ownerName", event.target.value)}
            />
            <Input
              label="Business name"
              value={businessProfile.businessName}
              onChange={(event) => setBusinessProfileField("businessName", event.target.value)}
            />
            <Input
              label="Business email"
              value={businessProfile.businessEmail}
              onChange={(event) => setBusinessProfileField("businessEmail", event.target.value)}
            />
            <Input
              label="Business phone"
              value={businessProfile.businessPhone}
              onChange={(event) => setBusinessProfileField("businessPhone", event.target.value)}
            />
            <Input
              label="Website"
              value={businessProfile.website}
              onChange={(event) => setBusinessProfileField("website", event.target.value)}
            />
            <Input
              label="Location"
              value={businessProfile.location}
              onChange={(event) => setBusinessProfileField("location", event.target.value)}
            />
          </div>
        </Card>

        <Card className="space-y-5 xl:col-span-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
              <ShieldCheck size={18} className="text-[var(--color-accent)]" />
            </span>
            <div>
              <p className="section-kicker">Connection health</p>
              <h2 className="display-title !text-[var(--text-lg)]">Current backend readiness</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
              <p className="section-kicker">Mail</p>
              <p className="mt-2 text-lg font-medium">
                {stateQuery.data?.sync.emailConnectorReady ? "Connected" : "Not connected"}
              </p>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
              <p className="section-kicker">Calls</p>
              <p className="mt-2 text-lg font-medium">
                {stateQuery.data?.sync.callConnectorReady ? "Connected" : "Not connected"}
              </p>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
              <p className="section-kicker">Stripe</p>
              <p className="mt-2 text-lg font-medium">
                {stateQuery.data?.sync.stripeConnectorReady ? "Connected" : "Not connected"}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </PageWrapper>
  );
}
