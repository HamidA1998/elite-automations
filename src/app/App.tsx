import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { NewAccountModal, type NewAccountPayload } from "@/components/features/crm/NewAccountModal";

import { CommandCentrePage } from "@/pages/CommandCentrePage";

import { useNotifications } from "@/hooks/use-notifications";
import { useTime } from "@/hooks/use-time";
import { createAccount } from "@/services/api";
import { useThemeStore } from "@/stores/theme-store";

const AgentsPage = lazy(() => import("@/pages/AgentsPage").then((module) => ({ default: module.AgentsPage })));
const AgencyLaunchPage = lazy(() => import("@/pages/AgencyLaunchPage").then((module) => ({ default: module.AgencyLaunchPage })));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const MarketsPage = lazy(() => import("@/pages/MarketsPage").then((module) => ({ default: module.MarketsPage })));
const LeadDetailPage = lazy(() => import("@/pages/LeadDetailPage").then((module) => ({ default: module.LeadDetailPage })));
const LeadsPipelinePage = lazy(() => import("@/pages/LeadsPipelinePage").then((module) => ({ default: module.LeadsPipelinePage })));
const PlannerPage = lazy(() => import("@/pages/PlannerPage").then((module) => ({ default: module.PlannerPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const CRMOverviewPage = lazy(() => import("@/pages/crm/CRMOverviewPage").then((module) => ({ default: module.CRMOverviewPage })));
const ContactsPage = lazy(() => import("@/pages/crm/ContactsPage").then((module) => ({ default: module.ContactsPage })));
const PipelinePage = lazy(() => import("@/pages/crm/PipelinePage").then((module) => ({ default: module.PipelinePage })));
const ActivityPage = lazy(() => import("@/pages/crm/ActivityPage").then((module) => ({ default: module.ActivityPage })));
const AICommandPage = lazy(() => import("@/pages/ai/AICommandPage").then((module) => ({ default: module.AICommandPage })));
const ScraperPage = lazy(() => import("@/pages/ai/ScraperPage").then((module) => ({ default: module.ScraperPage })));
const ImageGenPage = lazy(() => import("@/pages/ai/ImageGenPage").then((module) => ({ default: module.ImageGenPage })));
const AgentRunnerPage = lazy(() => import("@/pages/ai/AgentRunnerPage").then((module) => ({ default: module.AgentRunnerPage })));
const IntelPage = lazy(() => import("@/pages/ai/IntelPage").then((module) => ({ default: module.IntelPage })));
const MailInboxPage = lazy(() => import("@/pages/mail/MailInboxPage").then((module) => ({ default: module.MailInboxPage })));
const ComposePage = lazy(() => import("@/pages/mail/ComposePage").then((module) => ({ default: module.ComposePage })));
const TemplatesPage = lazy(() => import("@/pages/mail/TemplatesPage").then((module) => ({ default: module.TemplatesPage })));
const CampaignsPage = lazy(() => import("@/pages/mail/CampaignsPage").then((module) => ({ default: module.CampaignsPage })));
const PayRevenuePage = lazy(() => import("@/pages/pay/PayRevenuePage").then((module) => ({ default: module.PayRevenuePage })));
const InvoicesPage = lazy(() => import("@/pages/pay/InvoicesPage").then((module) => ({ default: module.InvoicesPage })));
const PaymentLinksPage = lazy(() => import("@/pages/pay/PaymentLinksPage").then((module) => ({ default: module.PaymentLinksPage })));
const CustomersPage = lazy(() => import("@/pages/pay/CustomersPage").then((module) => ({ default: module.CustomersPage })));
const SubscriptionsPage = lazy(() => import("@/pages/pay/SubscriptionsPage").then((module) => ({ default: module.SubscriptionsPage })));
const ProductsPage = lazy(() => import("@/pages/pay/ProductsPage").then((module) => ({ default: module.ProductsPage })));
const PersonalPage = lazy(() => import("@/pages/PersonalPage").then((module) => ({ default: module.PersonalPage })));
const OpsCommandPage = lazy(() => import("@/pages/ops/OpsCommandPage").then((module) => ({ default: module.OpsCommandPage })));
const RevenueRadarPage = lazy(() => import("@/pages/ops/RevenueRadarPage").then((module) => ({ default: module.RevenueRadarPage })));
const OpsMetricsPage = lazy(() => import("@/pages/ops/OpsMetricsPage").then((module) => ({ default: module.OpsMetricsPage })));
const AutomationPage = lazy(() => import("@/pages/ops/AutomationPage").then((module) => ({ default: module.AutomationPage })));
const WorkflowsPage = lazy(() => import("@/pages/ops/WorkflowsPage").then((module) => ({ default: module.WorkflowsPage })));
const ApprovalsPage = lazy(() => import("@/pages/ops/ApprovalsPage").then((module) => ({ default: module.ApprovalsPage })));
const ToolForgePage = lazy(() => import("@/pages/ops/ToolForgePage").then((module) => ({ default: module.ToolForgePage })));
const OwnedToolPage = lazy(() => import("@/pages/ops/OwnedToolPage").then((module) => ({ default: module.OwnedToolPage })));
const TunnelPage = lazy(() => import("@/pages/ops/TunnelPage").then((module) => ({ default: module.TunnelPage })));
const SystemHealthPage = lazy(() => import("@/pages/ops/SystemHealthPage").then((module) => ({ default: module.SystemHealthPage })));
const TimelinePage = lazy(() => import("@/pages/TimelinePage").then((module) => ({ default: module.TimelinePage })));
const CallsOverviewPage = lazy(() => import("@/pages/calls/CallsOverviewPage").then((module) => ({ default: module.CallsOverviewPage })));
const OutboundCallPage = lazy(() => import("@/pages/calls/OutboundCallPage").then((module) => ({ default: module.OutboundCallPage })));
const CallLogsPage = lazy(() => import("@/pages/calls/CallLogsPage").then((module) => ({ default: module.CallLogsPage })));
const MessagesPage = lazy(() => import("@/pages/calls/MessagesPage").then((module) => ({ default: module.MessagesPage })));
const AgentConfigPage = lazy(() => import("@/pages/calls/AgentConfigPage").then((module) => ({ default: module.AgentConfigPage })));
const VidLibraryPage = lazy(() => import("@/pages/vid/VidLibraryPage").then((module) => ({ default: module.VidLibraryPage })));
const VidAssetsPage = lazy(() => import("@/pages/vid/VidAssetsPage").then((module) => ({ default: module.VidAssetsPage })));

function RouteFallback() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="executive-panel p-6">
        <p className="section-kicker">Loading workspace</p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Preparing the next operating surface.</p>
      </div>
    </div>
  );
}

export function App() {
  const { greeting, dayLabel, timeLabel, timeMode } = useTime();
  const { permission, requestPermission } = useNotifications();
  const themeMode = useThemeStore((state) => state.themeMode);
  const resolveTheme = useThemeStore((state) => state.resolveTheme);
  const setThemeMode = useThemeStore((state) => state.setThemeMode);
  const activeTheme = resolveTheme(timeMode);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newAccountOpen, setNewAccountOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    document.documentElement.dataset.timeMode = timeMode;
  }, [activeTheme, timeMode]);

  const cycleTheme = () => {
    const sequence = ["auto", "dawn", "day", "dusk", "night"] as const;
    const next = sequence[(sequence.indexOf(themeMode) + 1) % sequence.length];
    setThemeMode(next);
  };

  const createAccountMutation = useMutation({
    mutationFn: (payload: NewAccountPayload) => createAccount(payload),
    onSuccess: async ({ clientId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-state"] }),
        queryClient.invalidateQueries({ queryKey: ["lead-pipeline"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      ]);
      navigate(`/leads/${clientId}`);
    },
  });

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            element={
              <AppShell
                timeMode={timeMode}
                themeMode={themeMode}
                activeTheme={activeTheme}
                greeting={greeting}
                dayLabel={dayLabel}
                timeLabel={timeLabel}
                notificationPermission={permission}
                onThemeToggle={cycleTheme}
                onEnableNotifications={requestPermission}
                onCreateAccount={() => setNewAccountOpen(true)}
              />
            }
          >
            {/* EA — Command Centre */}
            <Route index element={<CommandCentrePage />} />
            <Route path="/agency" element={<AgencyLaunchPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/markets" element={<MarketsPage />} />
            <Route path="/leads" element={<LeadsPipelinePage />} />
            <Route path="/leads/:clientId" element={<LeadDetailPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  themeMode={themeMode}
                  onThemeModeChange={setThemeMode}
                  notificationPermission={permission}
                  onEnableNotifications={requestPermission}
                />
              }
            />

            {/* CRM */}
            <Route path="/crm" element={<CRMOverviewPage />} />
            <Route path="/crm/contacts" element={<ContactsPage />} />
            <Route path="/crm/pipeline" element={<PipelinePage />} />
            <Route path="/crm/activity" element={<ActivityPage />} />

            {/* AI */}
            <Route path="/ai" element={<AICommandPage />} />
            <Route path="/ai/scraper" element={<ScraperPage />} />
            <Route path="/ai/imagegen" element={<ImageGenPage />} />
            <Route path="/ai/agents" element={<AgentRunnerPage />} />
            <Route path="/ai/intel" element={<IntelPage />} />

            {/* MAIL */}
            <Route path="/mail" element={<MailInboxPage />} />
            <Route path="/mail/compose" element={<ComposePage />} />
            <Route path="/mail/templates" element={<TemplatesPage />} />
            <Route path="/mail/campaigns" element={<CampaignsPage />} />

            {/* PAY */}
            <Route path="/pay" element={<PayRevenuePage />} />
            <Route path="/pay/invoices" element={<InvoicesPage />} />
            <Route path="/pay/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/pay/products" element={<ProductsPage />} />
            <Route path="/pay/links" element={<PaymentLinksPage />} />
            <Route path="/pay/customers" element={<CustomersPage />} />

            {/* PERSONAL */}
            <Route path="/personal" element={<PersonalPage />} />

            {/* OPS */}
            <Route path="/ops" element={<OpsCommandPage />} />
            <Route path="/ops/revenue-radar" element={<RevenueRadarPage />} />
            <Route path="/ops/metrics" element={<OpsMetricsPage />} />
            <Route path="/ops/automation" element={<AutomationPage />} />
            <Route path="/ops/workflows" element={<WorkflowsPage />} />
            <Route path="/ops/approvals" element={<ApprovalsPage />} />
            <Route path="/ops/tools" element={<ToolForgePage />} />
            <Route path="/ops/tools/:toolId" element={<OwnedToolPage />} />
            <Route path="/ops/tunnel" element={<TunnelPage />} />
            <Route path="/ops/health" element={<SystemHealthPage />} />

            {/* TIMELINE */}
            <Route path="/timeline" element={<TimelinePage />} />

            {/* CALLS */}
            <Route path="/calls" element={<CallsOverviewPage />} />
            <Route path="/calls/outbound" element={<OutboundCallPage />} />
            <Route path="/calls/logs" element={<CallLogsPage />} />
            <Route path="/calls/messages" element={<MessagesPage />} />
            <Route path="/calls/agents" element={<AgentConfigPage />} />

            {/* VID */}
            <Route path="/vid" element={<VidLibraryPage />} />
            <Route path="/vid/assets" element={<VidAssetsPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
      <NewAccountModal
        open={newAccountOpen}
        onClose={() => setNewAccountOpen(false)}
        onSubmit={async (payload) => {
          await createAccountMutation.mutateAsync(payload);
        }}
        isSubmitting={createAccountMutation.isPending}
      />
    </>
  );
}
