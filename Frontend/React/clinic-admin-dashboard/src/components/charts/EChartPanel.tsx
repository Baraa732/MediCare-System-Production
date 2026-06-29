import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

interface EChartPanelProps {
  title?: string;
  caption?: string;
  option: EChartsOption;
  height?: number;
}

export function EChartPanel({
  title,
  caption,
  option,
  height = 320,
}: EChartPanelProps) {
  if (!title) {
    return (
      <ReactECharts
        option={option}
        style={{ height, width: "100%" }}
        notMerge
        lazyUpdate
      />
    );
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden h-full flex flex-col">
      <header className="px-5 py-4 border-b border-neutral-100">
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
        {caption && <p className="text-sm text-neutral-500 mt-0.5">{caption}</p>}
      </header>
      <div className="flex-1 p-3">
        <ReactECharts
          option={option}
          style={{ height, width: "100%" }}
          notMerge
          lazyUpdate
        />
      </div>
    </section>
  );
}
