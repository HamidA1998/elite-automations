import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ArrowUpRight, CheckCircle2, Copy, Globe2, Mail, NotebookPen, Phone, PlayCircle, RefreshCcw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Input } from "@/components/ui/Input";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { LeadStatusBadge } from "@/components/features/LeadStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  fetchAssetText,
  createLeadNote,
  createLeadContact,
  createLeadTask,
  createLeadTimelineEvent,
  fetchLeadDetail,
  queueLeadDemo,
  queueLeadEmail,
  queueLeadVideo,
  runLeadBrowserAudit,
  saveLeadMemory,
  saveLeadProposal,
  updateLeadStatus,
  sendOpenClawCommand,
} from "@/services/api";

const statusOptions = [
  "researched",
  "ready-to-send",
  "contacted",
  "in-follow-up",
  "replied",
  "proposal",
  "won",
  "lost",
];

const accountTabs = ["Overview", "Contacts", "Timeline", "Tasks", "Proposal", "Memory", "Notes"] as const;
type AccountTab = (typeof accountTabs)[number];

export function LeadDetailPage() {
  const {clientId = ""} = useParams();
  const [activeTab, setActiveTab] = useState<AccountTab>("Overview");
  const [noteBody, setNoteBody] = useState("");
  const [jarvisAdvice, setJarvisAdvice] = useState("");
  const [contactForm, setContactForm] = useState({
    fullName: "",
    role: "Decision maker",
    email: "",
    phone: "",
    linkedin: "",
    isPrimary: false,
    notes: "",
    status: "reachable" as const,
    bestTime: "Any time" as const,
    contactPreference: "Both" as const,
  });
  const [timelineForm, setTimelineForm] = useState({
    eventType: "Note added",
    timestamp: new Date().toISOString().slice(0, 16),
    contactName: "",
    notes: "",
    duration: "",
    followUpDate: "",
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "todo" as const,
    priority: "medium" as const,
    dueDate: new Date().toISOString().slice(0, 10),
    owner: "Hamid",
    lane: "ops",
    taskType: "Other",
  });
  const [proposalForm, setProposalForm] = useState({
    title: "Website proposal",
    status: "draft" as const,
    packageName: "",
    price: "",
    probability: "35",
    nextStep: "",
    scope: "",
    setupFee: "",
    monthlyRetainer: "",
    contractLength: "One-off",
    estimatedDelivery: "",
    sentDate: "",
    responseDate: "",
    notes: "",
  });
  const [memoryForm, setMemoryForm] = useState({
    personality: "",
    painPoints: "",
    whatResonates: "",
    whatToAvoid: "",
    decisionProcess: "",
    bestWindow: "",
    internalNotes: "",
  });
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ["lead-detail", clientId],
    queryFn: () => fetchLeadDetail(clientId),
    enabled: Boolean(clientId),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateLeadStatus(clientId, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["lead-detail", clientId]}),
        queryClient.invalidateQueries({queryKey: ["lead-pipeline"]}),
      ]);
    },
  });

  const queueDemo = useMutation({
    mutationFn: () => queueLeadDemo(clientId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["lead-detail", clientId]}),
        queryClient.invalidateQueries({queryKey: ["lead-pipeline"]}),
      ]);
    },
  });

  const queueEmail = useMutation({
    mutationFn: () => queueLeadEmail(clientId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["lead-detail", clientId]}),
        queryClient.invalidateQueries({queryKey: ["lead-pipeline"]}),
      ]);
    },
  });

  const queueVideo = useMutation({
    mutationFn: () => queueLeadVideo(clientId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["lead-detail", clientId]}),
        queryClient.invalidateQueries({queryKey: ["lead-pipeline"]}),
      ]);
    },
  });

  const browserAuditMutation = useMutation({
    mutationFn: () => runLeadBrowserAudit(clientId),
    onSuccess: async () => {
      setWorkspaceNotice("Browser audit completed and saved.");
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["lead-detail", clientId]}),
        queryClient.invalidateQueries({queryKey: ["lead-pipeline"]}),
      ]);
    },
    onError: (error) => {
      setWorkspaceNotice(error instanceof Error ? error.message : "Browser audit failed.");
    },
  });

  const noteMutation = useMutation({
    mutationFn: (body: string) => createLeadNote(clientId, body),
    onSuccess: async () => {
      setNoteBody("");
      await queryClient.invalidateQueries({queryKey: ["lead-detail", clientId]});
    },
  });

  const contactMutation = useMutation({
    mutationFn: () => createLeadContact(clientId, {
      ...contactForm,
      email: contactForm.email || null,
      phone: contactForm.phone || null,
      linkedin: contactForm.linkedin || null,
    }),
    onSuccess: async () => {
      setContactForm({
        fullName: "",
        role: "Decision maker",
        email: "",
        phone: "",
        linkedin: "",
        isPrimary: false,
        notes: "",
        status: "reachable",
        bestTime: "Any time",
        contactPreference: "Both",
      });
      setWorkspaceNotice("Contact saved.");
      await queryClient.invalidateQueries({queryKey: ["lead-detail", clientId]});
    },
  });

  const timelineMutation = useMutation({
    mutationFn: () => createLeadTimelineEvent(clientId, {
      eventType: timelineForm.eventType,
      timestamp: new Date(timelineForm.timestamp).toISOString(),
      contactName: timelineForm.contactName || null,
      notes: timelineForm.notes,
      duration: timelineForm.duration ? Number(timelineForm.duration) : null,
      followUpDate: timelineForm.followUpDate || null,
      loggedBy: "Hamid",
    }),
    onSuccess: async () => {
      setTimelineForm({
        eventType: "Note added",
        timestamp: new Date().toISOString().slice(0, 16),
        contactName: "",
        notes: "",
        duration: "",
        followUpDate: "",
      });
      setWorkspaceNotice("Timeline event logged.");
      await queryClient.invalidateQueries({queryKey: ["lead-detail", clientId]});
    },
  });

  const taskMutation = useMutation({
    mutationFn: () => createLeadTask(clientId, taskForm),
    onSuccess: async () => {
      setTaskForm({
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        dueDate: new Date().toISOString().slice(0, 10),
        owner: "Hamid",
        lane: "ops",
        taskType: "Other",
      });
      setWorkspaceNotice("Task added.");
      await queryClient.invalidateQueries({queryKey: ["lead-detail", clientId]});
    },
  });

  const proposalMutation = useMutation({
    mutationFn: () => saveLeadProposal(clientId, {
      title: proposalForm.title,
      status: proposalForm.status,
      packageName: proposalForm.packageName,
      price: Number(proposalForm.price || 0),
      probability: Number(proposalForm.probability || 0),
      nextStep: proposalForm.nextStep,
      scope: proposalForm.scope.split("\n").map((item) => item.trim()).filter(Boolean),
      setupFee: proposalForm.setupFee ? Number(proposalForm.setupFee) : undefined,
      monthlyRetainer: proposalForm.monthlyRetainer ? Number(proposalForm.monthlyRetainer) : null,
      contractLength: proposalForm.contractLength,
      estimatedDelivery: proposalForm.estimatedDelivery,
      sentDate: proposalForm.sentDate || null,
      responseDate: proposalForm.responseDate || null,
      notes: proposalForm.notes,
    }),
    onSuccess: async () => {
      setWorkspaceNotice("Proposal saved.");
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["lead-detail", clientId]}),
        queryClient.invalidateQueries({queryKey: ["lead-pipeline"]}),
      ]);
    },
  });

  const memoryMutation = useMutation({
    mutationFn: () => saveLeadMemory(clientId, memoryForm),
    onSuccess: async () => {
      setWorkspaceNotice("Memory saved.");
      await queryClient.invalidateQueries({queryKey: ["lead-detail", clientId]});
    },
  });

  const jarvisMutation = useMutation({
    mutationFn: async () => {
      if (!detail) return "";
      const response = await sendOpenClawCommand("jarvis", {
        message: [
          "Advise Hamid on the next best move for this lead.",
          `Business: ${detail.lead.businessName}`,
          `Type: ${detail.lead.businessType}`,
          `Area: ${detail.lead.area}`,
          `Stage: ${detail.lead.accountStatus}`,
          `Score: ${detail.lead.siteScore}/100`,
          `Current next action: ${detail.lead.nextActionNotes || "none"}`,
          `Top problems: ${detail.auditAnalysis.topProblems.join("; ") || "none"}`,
          `Recommended actions: ${detail.auditAnalysis.recommendedActions || "none"}`,
          `Contacts: ${detail.contacts.map((contact) => `${contact.fullName} ${contact.role}`).join("; ") || "none"}`,
          `Latest timeline: ${detail.timeline.slice(0, 3).map((event) => `${event.eventType}: ${event.notes}`).join(" | ") || "none"}`,
          "Reply in three short sections: Immediate move, Why it matters, Exact next message or action.",
        ].join("\n"),
      });
      return response.replyText;
    },
    onSuccess: (reply) => setJarvisAdvice(reply),
  });

  const detail = detailQuery.data;
  const emailPreviewQuery = useQuery({
    queryKey: ["lead-email-preview", detail?.lead.emailFile],
    queryFn: () => fetchAssetText(detail!.lead.emailFile!),
    enabled: Boolean(detail?.lead.emailFile),
  });

  const toOutputHref = (filePath: string | null) => {
    if (!filePath) return null;
    const marker = "/output/";
    const index = filePath.indexOf(marker);
    const relative = index >= 0 ? filePath.slice(index + marker.length) : filePath.replace(/^\/+/, "");
    return `http://127.0.0.1:3007/${relative}`;
  };
  const chartData = useMemo(
    () =>
      (detail?.auditScores ?? []).map((score) => ({
        name: score.criterion.replace(/([A-Z])/g, " $1").trim(),
        score: score.score,
      })),
    [detail?.auditScores],
  );
  const latestProposal = detail?.proposals[0] ?? null;
  const copyEmailPreview = async () => {
    if (!emailPreviewQuery.data?.content) return;
    await navigator.clipboard.writeText(emailPreviewQuery.data.content);
  };

  useEffect(() => {
    if (!detail?.memory) return;
    setMemoryForm({
      personality: detail.memory.personality ?? "",
      painPoints: detail.memory.painPoints ?? "",
      whatResonates: detail.memory.whatResonates ?? "",
      whatToAvoid: detail.memory.whatToAvoid ?? "",
      decisionProcess: detail.memory.decisionProcess ?? "",
      bestWindow: detail.memory.bestWindow ?? "",
      internalNotes: detail.memory.internalNotes ?? "",
    });
  }, [clientId, detail?.memory]);

  useEffect(() => {
    if (!latestProposal) return;
    setProposalForm({
      title: latestProposal.packageName || "Website proposal",
      status: (latestProposal.status as typeof proposalForm.status) || "draft",
      packageName: latestProposal.packageName ?? "",
      price: String(latestProposal.setupFee ?? 0),
      probability: String(latestProposal.closeProbability ?? 35),
      nextStep: latestProposal.notes || "",
      scope: latestProposal.services ?? "",
      setupFee: String(latestProposal.setupFee ?? ""),
      monthlyRetainer: latestProposal.monthlyRetainer == null ? "" : String(latestProposal.monthlyRetainer),
      contractLength: latestProposal.contractLength || "One-off",
      estimatedDelivery: latestProposal.estimatedDelivery || "",
      sentDate: latestProposal.sentDate || "",
      responseDate: latestProposal.responseDate || "",
      notes: latestProposal.notes || "",
    });
  }, [clientId, latestProposal]);

  if (detailQuery.isLoading) {
    return (
      <PageWrapper
        eyebrow="Lead detail"
        title="Loading lead workspace"
        description="Pulling the full audit, artifacts, contact routes, and activity log."
      >
        <div className="lead-detail-shell">
          <Skeleton className="h-[28rem] w-full" />
          <Skeleton className="h-[28rem] w-full" />
        </div>
      </PageWrapper>
    );
  }

  if (!detail) {
    return (
      <PageWrapper
        eyebrow="Lead detail"
        title="Lead not found"
        description="This record could not be loaded from the CRM."
        actions={
          <Link to="/leads">
            <Button variant="secondary">Back to leads</Button>
          </Link>
        }
      >
        <Card>
          <p className="body-copy text-sm">Try returning to the pipeline and opening the lead again.</p>
        </Card>
      </PageWrapper>
    );
  }

  const {lead} = detail;
  const fullMemory = {
    personality: detail.memory?.personality ?? memoryForm.personality,
    painPoints: detail.memory?.painPoints ?? memoryForm.painPoints,
    whatResonates: detail.memory?.whatResonates ?? memoryForm.whatResonates,
    whatToAvoid: detail.memory?.whatToAvoid ?? memoryForm.whatToAvoid,
    decisionProcess: detail.memory?.decisionProcess ?? memoryForm.decisionProcess,
    bestWindow: detail.memory?.bestWindow ?? memoryForm.bestWindow,
    internalNotes: detail.memory?.internalNotes ?? memoryForm.internalNotes,
  };

  const fieldClassName =
    "min-h-12 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-[var(--color-text)] outline-none transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] focus:border-[var(--color-accent)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.16)]";

  const renderOverviewTab = () => (
    <div className="lead-detail-shell">
      <div className="space-y-6">
        <Card className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-kicker">{lead.clientId}</p>
              <h2 className="display-title !text-[var(--text-lg)]">Business profile</h2>
            </div>
            <Badge variant="info">{lead.siteScore}/100</Badge>
          </div>
          <div className="lead-detail-form-grid">
            <div className="space-y-3 text-sm text-[var(--color-text-muted)]">
              <p><strong className="text-[var(--color-text)]">Area:</strong> {lead.area}</p>
              <p><strong className="text-[var(--color-text)]">Type:</strong> {lead.businessType}</p>
              <p><strong className="text-[var(--color-text)]">Address:</strong> {lead.address ?? "Not captured yet"}</p>
              <p><strong className="text-[var(--color-text)]">Rating:</strong> {lead.googleRating ?? "—"} ({lead.reviewCount ?? 0} reviews)</p>
            </div>
            <div className="space-y-3 text-sm text-[var(--color-text-muted)]">
              <p>
                <strong className="text-[var(--color-text)]">Website:</strong>{" "}
                {lead.websiteUrl ? (
                  <a href={lead.websiteUrl} target="_blank" rel="noreferrer" className="text-[var(--color-accent)]">
                    Open site
                  </a>
                ) : (
                  "No website"
                )}
              </p>
              <p>
                <strong className="text-[var(--color-text)]">Phone:</strong>{" "}
                {lead.phoneNumber ? (
                  <a href={`tel:${lead.phoneNumber}`} className="text-[var(--color-accent)]">{lead.phoneNumber}</a>
                ) : (
                  "Not captured"
                )}
              </p>
              <p>
                <strong className="text-[var(--color-text)]">Email:</strong>{" "}
                {lead.emailAddress ? (
                  <a href={`mailto:${lead.emailAddress}`} className="text-[var(--color-accent)]">{lead.emailAddress}</a>
                ) : (
                  "Not captured"
                )}
              </p>
              <p><strong className="text-[var(--color-text)]">Next step:</strong> {lead.nextActionNotes || "No next step set."}</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="section-kicker">Audit report</p>
            <h2 className="display-title !text-[var(--text-lg)]">Category score breakdown</h2>
          </div>
          {chartData.length ? (
            <div className="h-[18rem]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{left: 24, right: 8, top: 8, bottom: 8}}>
                  <XAxis type="number" domain={[0, 10]} hide />
                  <YAxis type="category" dataKey="name" width={140} tick={{fill: "var(--color-text-muted)", fontSize: 12}} />
                  <Bar dataKey="score" fill="var(--color-accent)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-sm text-[var(--color-text-muted)]">
              No audit data yet. Run discovery or fill scores in the CRM to see category breakdown here.
            </div>
          )}
          <div className="lead-detail-form-grid">
            <div>
              <p className="section-kicker">Top 3 problems</p>
              {detail.auditAnalysis.topProblems.length ? (
                <ol className="mt-3 space-y-2 text-sm text-[var(--color-error)]">
                  {detail.auditAnalysis.topProblems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">No problems have been derived yet.</p>
              )}
            </div>
            <div>
              <p className="section-kicker">Recommended actions</p>
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                {detail.auditAnalysis.recommendedActions || "No recommended actions logged yet."}
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-kicker">Playwright browser audit</p>
              <h2 className="display-title !text-[var(--text-lg)]">Human-style website inspection</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
                Opens the website in a real browser, captures screenshots, reads headings, CTAs, forms, contact routes, technical errors, and turns the evidence into a conversion plan.
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={!lead.websiteUrl || browserAuditMutation.isPending}
              onClick={() => browserAuditMutation.mutate()}
            >
              <Globe2 size={16} />
              {browserAuditMutation.isPending ? "Auditing…" : "Run browser audit"}
            </Button>
          </div>
          {detail.browserAudits.length ? (
            <div className="space-y-4">
              {detail.browserAudits.slice(0, 2).map((audit) => (
                <article key={audit.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text)]">{audit.summary}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {new Date(audit.createdAt).toLocaleString("en-GB")} · loaded in {Math.round((audit.evidence.loadMs ?? 0) / 1000)}s · {audit.evidence.pagesVisited?.length ?? 0} pages inspected
                      </p>
                    </div>
                    {audit.screenshotPath ? (
                      <a href={toOutputHref(audit.screenshotPath) ?? "#"} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-accent)] hover:underline">
                        Screenshot
                      </a>
                    ) : null}
                  </div>
                  <div className="lead-detail-three-grid mt-4">
                    <div>
                      <p className="section-kicker !text-[9px]">Flaws</p>
                      <ul className="mt-2 space-y-2 text-xs leading-5 text-[var(--color-error)]">
                        {audit.flaws.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="section-kicker !text-[9px]">Plan</p>
                      <ul className="mt-2 space-y-2 text-xs leading-5 text-[var(--color-text-muted)]">
                        {audit.plan.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="section-kicker !text-[9px]">Evidence</p>
                      <div className="mt-2 space-y-2 text-xs leading-5 text-[var(--color-text-muted)]">
                        <p>Headings: {audit.evidence.headings?.length ?? 0}</p>
                        <p>CTAs/buttons: {audit.evidence.buttons?.length ?? 0}</p>
                        <p>Forms/inputs: {audit.evidence.forms ?? 0}</p>
                        <p>Console errors: {audit.evidence.consoleErrors?.length ?? 0}</p>
                        <p>Failed requests: {audit.evidence.failedRequests?.length ?? 0}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-8 text-sm text-[var(--color-text-muted)]">
              No browser audit saved yet. Run one to create the clickable evidence pack for this business.
            </div>
          )}
        </Card>

        {jarvisAdvice ? (
          <Card className="space-y-5">
            <div>
              <p className="section-kicker">Jarvis recommendation</p>
              <h2 className="display-title !text-[var(--text-lg)]">AI operator guidance</h2>
            </div>
            <pre className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm whitespace-pre-wrap text-[var(--color-text-muted)]">
              {jarvisAdvice}
            </pre>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="section-kicker">Creative assets</p>
              <h2 className="display-title !text-[var(--text-lg)]">Demo, email, and video</h2>
            </div>
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
              <RefreshCcw size={18} className="text-[var(--color-accent)]" />
            </span>
          </div>
          {lead.imageHero ? (
            <img src={toOutputHref(lead.imageHero) ?? undefined} alt={lead.businessName} className="aspect-[16/10] w-full rounded-[var(--radius-xl)] object-cover" />
          ) : (
            <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-sm text-[var(--color-text-muted)]">No hero image attached yet.</div>
          )}
          <div className="grid gap-3">
            <Button variant="secondary" onClick={() => queueDemo.mutate()}><RefreshCcw size={16} />Build demo</Button>
            <Button variant="secondary" onClick={() => queueVideo.mutate()}><PlayCircle size={16} />Render video</Button>
            <Button onClick={() => queueEmail.mutate()}><Mail size={16} />Send email</Button>
          </div>
          <div className="space-y-3 text-sm">
            {lead.demoFile ? <a href={toOutputHref(lead.demoFile) ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[var(--color-accent)]">Open demo<ArrowUpRight size={14} /></a> : null}
            {lead.videoFile ? <a href={toOutputHref(lead.videoFile) ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[var(--color-accent)]">Open preview video<ArrowUpRight size={14} /></a> : null}
            {lead.emailFile ? <a href={toOutputHref(lead.emailFile) ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[var(--color-accent)]">Open email draft<ArrowUpRight size={14} /></a> : null}
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="section-kicker">Preview surfaces</p>
            <h2 className="display-title !text-[var(--text-lg)]">Demo, video, and email preview</h2>
          </div>
          <div className="space-y-4">
            {lead.demoFile ? (
              <div className="space-y-2">
                <p className="section-kicker">Demo preview</p>
                <iframe src={toOutputHref(lead.demoFile) ?? undefined} title={`${lead.businessName} demo`} className="h-72 w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white" />
              </div>
            ) : null}
            {lead.videoFile ? (
              <div className="space-y-2">
                <p className="section-kicker">Video preview</p>
                <video controls className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)]" src={toOutputHref(lead.videoFile) ?? undefined} />
              </div>
            ) : null}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="section-kicker">Email preview</p>
                <Button variant="ghost" onClick={copyEmailPreview} disabled={!emailPreviewQuery.data?.content}>
                  <Copy size={14} />
                  Copy
                </Button>
              </div>
              {emailPreviewQuery.data ? (
                <pre className="max-h-72 overflow-auto rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm whitespace-pre-wrap text-[var(--color-text-muted)]">{emailPreviewQuery.data.content}</pre>
              ) : (
                <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-8 text-sm text-[var(--color-text-muted)]">No email draft is attached yet.</div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderContactsTab = () => (
    <div className="lead-detail-wide-split">
      <Card className="space-y-4">
        <div>
          <p className="section-kicker">Add contact</p>
          <h2 className="display-title !text-[var(--text-lg)]">Stakeholder entry</h2>
        </div>
        <Input label="Full name" value={contactForm.fullName} onChange={(event) => setContactForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Owner or practice manager" />
        <Input label="Role / job title" value={contactForm.role} onChange={(event) => setContactForm((current) => ({ ...current, role: event.target.value }))} placeholder="Decision maker" />
        <Input label="Email" value={contactForm.email} onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))} placeholder="hello@business.co.uk" />
        <Input label="Phone" value={contactForm.phone} onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+44..." />
        <Input label="LinkedIn URL" value={contactForm.linkedin} onChange={(event) => setContactForm((current) => ({ ...current, linkedin: event.target.value }))} placeholder="https://linkedin.com/in/..." />
        <div className="lead-detail-form-grid">
          <label className="flex flex-col gap-2">
            <span className="section-kicker">Best time</span>
            <select className={fieldClassName} value={contactForm.bestTime} onChange={(event) => setContactForm((current) => ({ ...current, bestTime: event.target.value as typeof current.bestTime }))}>
              {["Morning 9–12", "Afternoon 12–5", "Evening 5–7", "Any time"].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="section-kicker">Contact preference</span>
            <select className={fieldClassName} value={contactForm.contactPreference} onChange={(event) => setContactForm((current) => ({ ...current, contactPreference: event.target.value as typeof current.contactPreference }))}>
              {["Email first", "Call first", "Both"].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
          <input type="checkbox" checked={contactForm.isPrimary} onChange={(event) => setContactForm((current) => ({ ...current, isPrimary: event.target.checked }))} />
          Mark as primary contact
        </label>
        <label className="flex flex-col gap-2">
          <span className="section-kicker">Notes</span>
          <textarea rows={4} className={`${fieldClassName} py-3`} value={contactForm.notes} onChange={(event) => setContactForm((current) => ({ ...current, notes: event.target.value }))} placeholder="How to approach them, what they care about, and whether they are the decision maker." />
        </label>
        <Button onClick={() => contactMutation.mutate()} disabled={!contactForm.fullName.trim() || contactMutation.isPending}>
          {contactMutation.isPending ? "Saving contact..." : "Add contact"}
        </Button>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="section-kicker">Stakeholders</p>
          <h2 className="display-title !text-[var(--text-lg)]">Contact intelligence</h2>
        </div>
        {detail.contacts.length ? detail.contacts.map((contact) => (
          <div key={contact.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[var(--color-text)]">{contact.fullName}</p>
              {contact.isPrimary ? <Badge variant="success">Primary</Badge> : null}
              <Badge variant="neutral">{contact.role}</Badge>
              <Badge variant="info">{contact.contactPreference}</Badge>
            </div>
            <div className="mt-3 space-y-2 text-sm text-[var(--color-text-muted)]">
              {contact.email ? <a href={`mailto:${contact.email}`} className="block text-[var(--color-accent)]">{contact.email}</a> : null}
              {contact.phone ? <a href={`tel:${contact.phone}`} className="block text-[var(--color-accent)]">{contact.phone}</a> : null}
              {contact.linkedIn ? <a href={contact.linkedIn} target="_blank" rel="noreferrer" className="block text-[var(--color-accent)]">LinkedIn profile</a> : null}
              <p>Best time: {contact.bestTime}</p>
              <p>Status: {contact.status}</p>
              <p>{contact.notes || "No notes logged yet."}</p>
            </div>
          </div>
        )) : (
          <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-sm text-[var(--color-text-muted)]">No contacts yet. Add the decision-maker so the outreach system has someone real to work with.</div>
        )}
      </Card>
    </div>
  );

  const renderTimelineTab = () => (
    <div className="lead-detail-split">
      <Card className="space-y-4">
        <div>
          <p className="section-kicker">Log event</p>
          <h2 className="display-title !text-[var(--text-lg)]">Outreach history</h2>
        </div>
        <Input label="Event type" value={timelineForm.eventType} onChange={(event) => setTimelineForm((current) => ({ ...current, eventType: event.target.value }))} placeholder="Email sent" />
        <Input label="Timestamp" type="datetime-local" value={timelineForm.timestamp} onChange={(event) => setTimelineForm((current) => ({ ...current, timestamp: event.target.value }))} />
        <Input label="Contact name" value={timelineForm.contactName} onChange={(event) => setTimelineForm((current) => ({ ...current, contactName: event.target.value }))} placeholder="Optional" />
        <Input label="Duration in minutes" type="number" min="0" value={timelineForm.duration} onChange={(event) => setTimelineForm((current) => ({ ...current, duration: event.target.value }))} placeholder="Only for calls" />
        <Input label="Follow-up date" type="date" value={timelineForm.followUpDate} onChange={(event) => setTimelineForm((current) => ({ ...current, followUpDate: event.target.value }))} />
        <label className="flex flex-col gap-2">
          <span className="section-kicker">Outcome / notes</span>
          <textarea rows={5} className={`${fieldClassName} py-3`} value={timelineForm.notes} onChange={(event) => setTimelineForm((current) => ({ ...current, notes: event.target.value }))} placeholder="What happened, what was said, and what comes next." />
        </label>
        <Button onClick={() => timelineMutation.mutate()} disabled={!timelineForm.eventType.trim() || !timelineForm.timestamp || timelineMutation.isPending}>
          {timelineMutation.isPending ? "Logging event..." : "Add timeline event"}
        </Button>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="section-kicker">Timeline</p>
          <h2 className="display-title !text-[var(--text-lg)]">Reverse chronological feed</h2>
        </div>
        {detail.timeline.length ? (
          <div className="space-y-3">
            {detail.timeline.map((event) => (
              <div key={event.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <LeadStatusBadge status={event.eventType} />
                  <p className="section-kicker">{new Date(event.timestamp).toLocaleString("en-GB")}</p>
                </div>
                {event.contactName ? <p className="mt-2 text-sm font-medium text-[var(--color-text)]">{event.contactName}</p> : null}
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{event.notes || "No notes logged."}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]">
                  <span>Logged by {event.loggedBy}</span>
                  {event.duration ? <span>{event.duration} mins</span> : null}
                  {event.followUpDate ? <span>Follow-up {event.followUpDate}</span> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-sm text-[var(--color-text-muted)]">No activity has been logged on this lead yet.</div>
        )}
      </Card>
    </div>
  );

  const renderTasksTab = () => (
    <div className="lead-detail-split">
      <Card className="space-y-4">
        <div>
          <p className="section-kicker">Add task</p>
          <h2 className="display-title !text-[var(--text-lg)]">Execution queue</h2>
        </div>
        <Input label="Task title" value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} placeholder="Send first email" />
        <Input label="Task type" value={taskForm.taskType} onChange={(event) => setTaskForm((current) => ({ ...current, taskType: event.target.value }))} placeholder="Follow up" />
        <div className="lead-detail-form-grid">
          <Input label="Assigned to" value={taskForm.owner} onChange={(event) => setTaskForm((current) => ({ ...current, owner: event.target.value }))} />
          <Input label="Due date" type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} />
        </div>
        <div className="lead-detail-form-grid">
          <label className="flex flex-col gap-2">
            <span className="section-kicker">Priority</span>
            <select className={fieldClassName} value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value as typeof current.priority }))}>
              {["high", "medium", "low"].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="section-kicker">Status</span>
            <select className={fieldClassName} value={taskForm.status} onChange={(event) => setTaskForm((current) => ({ ...current, status: event.target.value as typeof current.status }))}>
              {["todo", "doing", "done", "blocked"].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-2">
          <span className="section-kicker">Notes</span>
          <textarea rows={5} className={`${fieldClassName} py-3`} value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} placeholder="Any context that should travel with the task." />
        </label>
        <Button onClick={() => taskMutation.mutate()} disabled={!taskForm.title.trim() || !taskForm.dueDate || taskMutation.isPending}>
          {taskMutation.isPending ? "Adding task..." : "Add task"}
        </Button>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="section-kicker">Task list</p>
          <h2 className="display-title !text-[var(--text-lg)]">Open and completed work</h2>
        </div>
        {detail.tasks.length ? (
          <div className="space-y-3">
            {detail.tasks.map((task) => (
              <div key={task.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{task.title}</p>
                  <Badge variant={task.status === "done" ? "success" : task.status === "blocked" ? "error" : "neutral"}>{task.status}</Badge>
                  <Badge variant={task.priority === "high" ? "error" : task.priority === "medium" ? "warning" : "neutral"}>{task.priority}</Badge>
                </div>
                <div className="lead-detail-mini-grid mt-3 text-sm text-[var(--color-text-muted)]">
                  <p>Type: {task.taskType}</p>
                  <p>Assigned to: {task.assignedTo}</p>
                  <p>Due: {task.dueDate}</p>
                  <p>Created: {new Date(task.createdAt).toLocaleString("en-GB")}</p>
                </div>
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">{task.notes || "No notes logged for this task."}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-sm text-[var(--color-text-muted)]">No tasks yet. Use this panel to keep each account moving without leaving the main workspace.</div>
        )}
      </Card>
    </div>
  );

  const renderProposalTab = () => (
    <div className="lead-detail-split">
      <Card className="space-y-4">
        <div>
          <p className="section-kicker">Proposal builder</p>
          <h2 className="display-title !text-[var(--text-lg)]">Commercial package</h2>
        </div>
        <Input label="Proposal title" value={proposalForm.title} onChange={(event) => setProposalForm((current) => ({ ...current, title: event.target.value }))} placeholder="Premium website proposal" />
        <Input label="Package name" value={proposalForm.packageName} onChange={(event) => setProposalForm((current) => ({ ...current, packageName: event.target.value }))} placeholder="Starter site + automations" />
        <div className="lead-detail-form-grid">
          <Input label="Proposal value £" type="number" min="0" value={proposalForm.price} onChange={(event) => setProposalForm((current) => ({ ...current, price: event.target.value }))} placeholder="2500" />
          <Input label="Close probability %" type="number" min="0" max="100" value={proposalForm.probability} onChange={(event) => setProposalForm((current) => ({ ...current, probability: event.target.value }))} placeholder="35" />
          <Input label="Setup fee £" type="number" min="0" value={proposalForm.setupFee} onChange={(event) => setProposalForm((current) => ({ ...current, setupFee: event.target.value }))} />
          <Input label="Monthly retainer £" type="number" min="0" value={proposalForm.monthlyRetainer} onChange={(event) => setProposalForm((current) => ({ ...current, monthlyRetainer: event.target.value }))} />
        </div>
        <div className="lead-detail-form-grid">
          <Input label="Contract length" value={proposalForm.contractLength} onChange={(event) => setProposalForm((current) => ({ ...current, contractLength: event.target.value }))} />
          <Input label="Estimated delivery" value={proposalForm.estimatedDelivery} onChange={(event) => setProposalForm((current) => ({ ...current, estimatedDelivery: event.target.value }))} placeholder="2 weeks from sign-off" />
        </div>
        <Input label="Next step" value={proposalForm.nextStep} onChange={(event) => setProposalForm((current) => ({ ...current, nextStep: event.target.value }))} placeholder="Send proposal and book review call" />
        <div className="lead-detail-form-grid">
          <Input label="Sent date" type="date" value={proposalForm.sentDate} onChange={(event) => setProposalForm((current) => ({ ...current, sentDate: event.target.value }))} />
          <Input label="Response date" type="date" value={proposalForm.responseDate} onChange={(event) => setProposalForm((current) => ({ ...current, responseDate: event.target.value }))} />
        </div>
        <label className="flex flex-col gap-2">
          <span className="section-kicker">Status</span>
          <select className={fieldClassName} value={proposalForm.status} onChange={(event) => setProposalForm((current) => ({ ...current, status: event.target.value as typeof current.status }))}>
            {["draft", "sent", "negotiating", "accepted", "lost"].map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="section-kicker">Services included</span>
          <textarea rows={5} className={`${fieldClassName} py-3`} value={proposalForm.scope} onChange={(event) => setProposalForm((current) => ({ ...current, scope: event.target.value }))} placeholder="One service per line" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="section-kicker">Notes / terms</span>
          <textarea rows={4} className={`${fieldClassName} py-3`} value={proposalForm.notes} onChange={(event) => setProposalForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Commercial notes, terms, and constraints." />
        </label>
        <Button onClick={() => proposalMutation.mutate()} disabled={!proposalForm.packageName.trim() || !proposalForm.price || !proposalForm.nextStep.trim() || proposalMutation.isPending}>
          {proposalMutation.isPending ? "Saving proposal..." : "Save proposal"}
        </Button>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="section-kicker">Current proposal</p>
          <h2 className="display-title !text-[var(--text-lg)]">Commercial snapshot</h2>
        </div>
        {latestProposal ? (
          <div className="space-y-4 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-[var(--color-text)]">{latestProposal.packageName}</p>
              <Badge variant={latestProposal.status === "accepted" ? "success" : latestProposal.status === "lost" ? "error" : "warning"}>{latestProposal.status}</Badge>
            </div>
            <p className="metric-mono text-3xl text-[var(--color-accent)]">£{latestProposal.setupFee.toLocaleString()}</p>
            <p className="text-sm text-[var(--color-text-muted)]">Weighted value £{Math.round(latestProposal.setupFee * (latestProposal.closeProbability / 100)).toLocaleString()}</p>
            <div className="grid gap-2 text-sm text-[var(--color-text-muted)]">
              <p>Contract: {latestProposal.contractLength || "Not set"}</p>
              <p>Delivery: {latestProposal.estimatedDelivery || "Not set"}</p>
              <p>Sent: {latestProposal.sentDate || "Not sent yet"}</p>
              <p>Response: {latestProposal.responseDate || "No response yet"}</p>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-[var(--color-text-muted)]">{latestProposal.services || "No services listed yet."}</pre>
            <p className="text-sm text-[var(--color-text-muted)]">{latestProposal.notes || "No commercial notes logged yet."}</p>
          </div>
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-10 text-sm text-[var(--color-text-muted)]">No proposal attached yet. Build the offer here so pipeline and pay metrics can start reflecting real commercial intent.</div>
        )}
      </Card>
    </div>
  );

  const renderMemoryTab = () => (
    <div className="lead-detail-wide-split">
      <Card className="space-y-4">
        <p className="section-kicker">Personality / communication style</p>
        <textarea rows={4} className={`${fieldClassName} py-3`} value={memoryForm.personality} onChange={(event) => setMemoryForm((current) => ({ ...current, personality: event.target.value }))} placeholder={fullMemory.personality || "How this business owner responds best."} />
        <p className="section-kicker">Pain points identified</p>
        <textarea rows={4} className={`${fieldClassName} py-3`} value={memoryForm.painPoints} onChange={(event) => setMemoryForm((current) => ({ ...current, painPoints: event.target.value }))} placeholder={fullMemory.painPoints || "What they are missing or losing."} />
        <p className="section-kicker">What resonates</p>
        <textarea rows={4} className={`${fieldClassName} py-3`} value={memoryForm.whatResonates} onChange={(event) => setMemoryForm((current) => ({ ...current, whatResonates: event.target.value }))} placeholder={fullMemory.whatResonates || "What language and outcomes land well."} />
      </Card>
      <Card className="space-y-4">
        <p className="section-kicker">What to avoid</p>
        <textarea rows={4} className={`${fieldClassName} py-3`} value={memoryForm.whatToAvoid} onChange={(event) => setMemoryForm((current) => ({ ...current, whatToAvoid: event.target.value }))} placeholder={fullMemory.whatToAvoid || "What creates friction or resistance."} />
        <p className="section-kicker">Decision process</p>
        <textarea rows={4} className={`${fieldClassName} py-3`} value={memoryForm.decisionProcess} onChange={(event) => setMemoryForm((current) => ({ ...current, decisionProcess: event.target.value }))} placeholder={fullMemory.decisionProcess || "Who needs to approve and how decisions get made."} />
        <p className="section-kicker">Best outreach window</p>
        <textarea rows={3} className={`${fieldClassName} py-3`} value={memoryForm.bestWindow} onChange={(event) => setMemoryForm((current) => ({ ...current, bestWindow: event.target.value }))} placeholder={fullMemory.bestWindow || "When to call, email, or follow up."} />
        <p className="section-kicker">Internal notes for Hamid</p>
        <textarea rows={5} className={`${fieldClassName} py-3`} value={memoryForm.internalNotes} onChange={(event) => setMemoryForm((current) => ({ ...current, internalNotes: event.target.value }))} placeholder={fullMemory.internalNotes || "Private account memory and judgment notes."} />
        <Button onClick={() => memoryMutation.mutate()} disabled={memoryMutation.isPending}>
          {memoryMutation.isPending ? "Saving memory..." : "Save memory"}
        </Button>
      </Card>
    </div>
  );

  const renderNotesTab = () => (
    <Card className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-kicker">Notes</p>
          <h2 className="display-title !text-[var(--text-lg)]">Operator context</h2>
        </div>
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--color-surface-3)]">
          <NotebookPen size={18} className="text-[var(--color-accent)]" />
        </span>
      </div>
      <div className="space-y-3">
        <Input label="Add a note for this lead" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Capture an objection, conversation detail, or next-step note." />
        <Button onClick={() => noteMutation.mutate(noteBody)} disabled={!noteBody.trim() || noteMutation.isPending}>Save note</Button>
        {detail.notes.length ? (
          <div className="space-y-3">
            {detail.notes.map((note) => (
              <div key={note.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
                <p className="section-kicker">{new Date(note.createdAt).toLocaleString("en-GB")}</p>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{note.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] px-6 py-8 text-sm text-[var(--color-text-muted)]">No operator notes stored on this lead yet.</div>
        )}
      </div>
    </Card>
  );

  return (
    <PageWrapper
      eyebrow="Lead detail"
      title={lead.businessName}
      description={`${lead.businessType} in ${lead.area}. Audit, creative assets, outreach history, and next actions now live in one workspace.`}
        actions={
        <div className="flex flex-wrap items-center gap-3">
          <LeadStatusBadge status={lead.accountStatus} />
          <Link to={`/ops/tools/evidence-dossier?clientId=${encodeURIComponent(clientId)}`}>
            <Button variant="secondary">
              Evidence dossier
              <ArrowUpRight size={14} />
            </Button>
          </Link>
          <Button variant="ghost" onClick={() => jarvisMutation.mutate()} disabled={jarvisMutation.isPending}>
            Ask Jarvis what to do next
          </Button>
          <select
            value={lead.accountStatus}
            onChange={(event) => statusMutation.mutate(event.target.value)}
            className="min-h-11 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
          {accountTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-[var(--radius-xl)] px-4 py-2.5 text-sm font-medium transition-all duration-[var(--duration-base)] ${
                activeTab === tab
                  ? "bg-[var(--color-accent)] text-white shadow-[var(--shadow-sm)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {workspaceNotice ? (
          <div className="flex items-center gap-2 rounded-[var(--radius-xl)] bg-green-500/10 px-4 py-3 text-sm text-green-300">
            <CheckCircle2 size={15} />
            {workspaceNotice}
          </div>
        ) : null}

        {activeTab === "Overview" ? renderOverviewTab() : null}
        {activeTab === "Contacts" ? renderContactsTab() : null}
        {activeTab === "Timeline" ? renderTimelineTab() : null}
        {activeTab === "Tasks" ? renderTasksTab() : null}
        {activeTab === "Proposal" ? renderProposalTab() : null}
        {activeTab === "Memory" ? renderMemoryTab() : null}
        {activeTab === "Notes" ? renderNotesTab() : null}
      </div>
    </PageWrapper>
  );
}
