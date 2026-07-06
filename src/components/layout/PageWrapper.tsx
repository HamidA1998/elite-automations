import type { ReactNode } from "react";

export interface PageWrapperProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  density?: "default" | "compact";
}

export function PageWrapper({
  eyebrow,
  title,
  description,
  actions,
  children,
  density = "default",
}: PageWrapperProps) {
  return (
    <div className={`page-wrapper mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6 xl:px-8 ${density === "compact" ? "page-wrapper--compact" : ""}`}>
      <header className="page-header-shell">
        <div className="page-header-copy">
          <p className="section-kicker">{eyebrow}</p>
          <h1 className="page-header-title">{title}</h1>
          <p className="page-header-description">{description}</p>
        </div>
        {actions ? <div className="page-header-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
