import { useMemo } from "react";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import type { EChartsOption } from "echarts";
import { EChartPanel } from "@/components/charts/EChartPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildChordOption,
  buildGaugeOption,
  buildHeatmapOption,
  buildParallelOption,
  buildSankeyOption,
  buildStreamgraphOption,
  buildTreemapOption,
} from "@/lib/charts/clinicChartBuilders";

export function AnalyticsPage() {
  const { appointments, doctors, staff, loading } = useClinicAdmin();

  const charts = useMemo(
    () => ({
      sankey: buildSankeyOption(appointments),
      treemap: buildTreemapOption(appointments, doctors),
      stream: buildStreamgraphOption(appointments),
      parallel: buildParallelOption(appointments, doctors),
      chord: buildChordOption(staff, appointments),
      heatmap: buildHeatmapOption(appointments),
      gauge: buildGaugeOption(appointments),
    }),
    [appointments, doctors, staff],
  );

  if (loading) {
    return <p className="text-neutral-500 py-12 text-center">Loading analytics…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
        <p className="text-neutral-500 mt-1">Advanced clinic performance charts (last 30 days)</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[
          ["Appointment flow", charts.sankey, 340],
          ["Volume by doctor", charts.treemap, 340],
          ["Status trend", charts.stream, 340],
          ["Doctor metrics (parallel)", charts.parallel, 340],
          ["Completion rate", charts.gauge, 300],
          ["Staff relations", charts.chord, 380],
        ].map(([title, option, height]) => (
          <Card key={title as string} className="ring-neutral-200">
            <CardHeader><CardTitle>{title as string}</CardTitle></CardHeader>
            <CardContent>
              <EChartPanel option={option as EChartsOption} height={height as number} />
            </CardContent>
          </Card>
        ))}
        <Card className="ring-neutral-200 xl:col-span-2">
          <CardHeader><CardTitle>Weekly booking heatmap</CardTitle></CardHeader>
          <CardContent><EChartPanel option={charts.heatmap} height={300} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
