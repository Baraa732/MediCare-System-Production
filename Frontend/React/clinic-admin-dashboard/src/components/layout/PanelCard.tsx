import type { ReactNode } from "react";

type PanelCardProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
};

export function PanelCard({
  title,
  subtitle,
  actions,
  children,
  noPadding,
}: PanelCardProps) {
  return (
    <section className="pbi-panel">
      <header className="pbi-panel-header">
        <div className="min-w-0">
          <h2 className="pbi-panel-title">{title}</h2>
          {subtitle && <p className="pbi-panel-subtitle">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className={noPadding ? "" : "pbi-panel-body"}>{children}</div>
    </section>
  );
}
