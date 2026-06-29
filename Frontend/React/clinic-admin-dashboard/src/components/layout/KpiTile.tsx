import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiTileProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: "brand" | "success" | "warning" | "neutral";
};

const accentBar = {
  brand: "bg-[#0066ff]",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  neutral: "bg-neutral-400",
};

export function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = "brand",
}: KpiTileProps) {
  return (
    <article className="pbi-kpi-tile">
      <div className={cn("pbi-kpi-accent", accentBar[accent])} />
      <div className="pbi-kpi-body">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="pbi-kpi-label">{label}</p>
            <p className="pbi-kpi-value">{value}</p>
            {hint && <p className="pbi-kpi-hint">{hint}</p>}
          </div>
          <div className="pbi-kpi-icon-wrap">
            <Icon className="w-4 h-4 text-[#0066ff]" strokeWidth={2.25} />
          </div>
        </div>
      </div>
    </article>
  );
}
