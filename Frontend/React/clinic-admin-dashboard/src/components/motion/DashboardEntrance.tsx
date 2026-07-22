import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type DashboardEntranceProps = {
  children: ReactNode;
  delay?: number;
  variant?: "fade" | "scale";
  className?: string;
};

/** Staggered entrance for dashboard sections (respects reduced motion). */
export function DashboardEntrance({
  children,
  delay = 0,
  variant = "fade",
  className,
}: DashboardEntranceProps) {
  return (
    <div
      className={cn(
        variant === "scale" ? "dashboard-enter-scale" : "dashboard-enter-fade",
        className,
      )}
      style={{ "--dash-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

export const DASHBOARD_MOTION = {
  durationMs: 560,
  headerDelayMs: 0,
  kpiBaseDelayMs: 120,
  kpiStaggerMs: 55,
  chartBaseDelayMs: 300,
  chartStaggerMs: 70,
  panelBaseDelayMs: 420,
  panelStaggerMs: 75,
} as const;

export function dashboardStaggerDelay(
  base: number,
  index: number,
  step: number = DASHBOARD_MOTION.kpiStaggerMs,
) {
  return base + index * step;
}
