import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EChartPanel } from "@/components/charts/EChartPanel";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import {
  buildChordOption,
  buildGaugeOption,
  buildHeatmapOption,
  buildParallelOption,
  buildSankeyOption,
  buildStreamgraphOption,
  buildTreemapOption,
  computeKpis,
} from "@/lib/charts/clinicChartBuilders";

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="ring-neutral-200 shadow-sm">
      <CardContent className="pt-5">
        <p className="text-sm text-neutral-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-neutral-900 mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { clinic, staff, doctors, appointments, loading, error, reload } =
    useClinicAdmin();

  const kpis = useMemo(
    () => computeKpis(appointments, staff, doctors),
    [appointments, staff, doctors],
  );

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
    return <div className="text-neutral-500 py-12 text-center">Loading clinic data…</div>;
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6 text-red-700">
          <p>{error}</p>
          <Button type="button" variant="outline" onClick={() => void reload()} className="mt-3">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-neutral-500">Clinic overview</p>
          <h1 className="text-2xl font-bold text-neutral-900">{clinic?.name ?? "Your clinic"}</h1>
        </div>
        <Button type="button" variant="outline" onClick={() => void reload()} className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Today's appointments" value={kpis.todayCount} />
        <KpiCard label="Pending requests" value={kpis.pendingCount} />
        <KpiCard label="Completed (30d)" value={kpis.completed30d} />
        <KpiCard label="Staff / doctors" value={`${kpis.staffCount} / ${kpis.doctorCount}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="ring-neutral-200">
          <CardHeader><CardTitle>Appointment flow (Sankey)</CardTitle></CardHeader>
          <CardContent><EChartPanel option={charts.sankey} height={320} /></CardContent>
        </Card>
        <Card className="ring-neutral-200">
          <CardHeader><CardTitle>Volume by doctor (Treemap)</CardTitle></CardHeader>
          <CardContent><EChartPanel option={charts.treemap} height={320} /></CardContent>
        </Card>
        <Card className="ring-neutral-200">
          <CardHeader><CardTitle>Status trend (Streamgraph)</CardTitle></CardHeader>
          <CardContent><EChartPanel option={charts.stream} height={320} /></CardContent>
        </Card>
        <Card className="ring-neutral-200">
          <CardHeader><CardTitle>Completion rate (Gauge)</CardTitle></CardHeader>
          <CardContent><EChartPanel option={charts.gauge} height={320} /></CardContent>
        </Card>
        <Card className="ring-neutral-200 xl:col-span-2">
          <CardHeader><CardTitle>Weekly heatmap</CardTitle></CardHeader>
          <CardContent><EChartPanel option={charts.heatmap} height={280} /></CardContent>
        </Card>
        <Card className="ring-neutral-200 xl:col-span-2">
          <CardHeader><CardTitle>Staff ↔ status relations (Chord)</CardTitle></CardHeader>
          <CardContent><EChartPanel option={charts.chord} height={360} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
