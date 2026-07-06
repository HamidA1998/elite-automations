import { Link } from "react-router-dom";
import { Bot, ArrowRight } from "lucide-react";

export function AgentRunnerPage() {
  return (
    <div className="p-6 md:p-10 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <p className="section-kicker">AI · OpenClaw</p>
        <h1 className="display-title mt-2">Agent runner</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Manage and trigger your OpenClaw AI agents.</p>
      </div>
      <div className="glass-panel rounded-[var(--radius-2xl)] p-8 flex flex-col items-center text-center gap-5">
        <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
          <Bot size={28} />
        </span>
        <div>
          <h2 className="font-semibold text-lg text-[var(--color-text)]">Full agent control in EA Agents</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-md">
            Your AI agents are managed in the EA module. Head there to start sessions, view logs, and approve actions.
          </p>
        </div>
        <Link
          to="/agents"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          Go to Agents <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
