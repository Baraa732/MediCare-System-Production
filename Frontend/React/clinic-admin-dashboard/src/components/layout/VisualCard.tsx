import type { ReactNode } from "react";
import { EChartPanel } from "@/components/charts/EChartPanel";
import type { EChartsOption } from "echarts";

type VisualCardProps = {
  title: string;
  subtitle?: string;
  option: EChartsOption;
  height?: number;
  footer?: ReactNode;
};

export function VisualCard({
  title,
  subtitle,
  option,
  height = 300,
  footer,
}: VisualCardProps) {
  return (
    <section className="pbi-visual">
      <header className="pbi-visual-header">
        <h2 className="pbi-visual-title">{title}</h2>
        {subtitle && <p className="pbi-visual-subtitle">{subtitle}</p>}
      </header>
      <div className="pbi-visual-body">
        <EChartPanel option={option} height={height} />
      </div>
      {footer && <footer className="pbi-visual-footer">{footer}</footer>}
    </section>
  );
}
