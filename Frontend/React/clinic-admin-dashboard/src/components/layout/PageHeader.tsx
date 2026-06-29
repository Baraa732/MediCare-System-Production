import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="pbi-page-header">
      <div className="min-w-0">
        <p className="pbi-eyebrow">Clinic workspace</p>
        <h1 className="pbi-page-title">{title}</h1>
        {subtitle && <p className="pbi-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
