import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Link } from "react-router";
import { Calendar, CheckCircle, Clock, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiTile } from "@/components/layout/KpiTile";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageError, PageLoading } from "@/components/layout/PageState";
import { PanelCard } from "@/components/layout/PanelCard";
import { VisualCard } from "@/components/layout/VisualCard";
import {
  DashboardEntrance,
  DASHBOARD_MOTION,
  dashboardStaggerDelay,
} from "@/components/motion/DashboardEntrance";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import {
  buildAppointmentTrendOption,
  buildDoctorWorkloadOption,
  buildStatusDonutOption,
  computeKpis,
} from "@/lib/charts/clinicChartBuilders";
import type { ApiAppointment } from "@/lib/api/types";

const STATUS_CLASS: Record<string, string> = {
  REQUESTED: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-[#ecf3ff] text-[#0066ff]",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
  NO_SHOW: "bg-violet-50 text-violet-700",
};

function doctorName(
  doctors: { userId: string; fullName?: string; firstName?: string; lastName?: string }[],
  id: string,
) {
  const d = doctors.find((x) => x.userId === id);
  if (!d) return "—";
  return d.fullName ?? (`${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || "Doctor");
}

function RecentAppointmentsTable({
  rows,
  doctors,
}: {
  rows: ApiAppointment[];
  doctors: ReturnType<typeof useClinicAdmin>["doctors"];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[#929296] py-8 text-center">No appointments in the last 30 days.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="pbi-data-table min-w-[640px]">
        <thead>
          <tr>
            <th>Date</th>
            <th>Doctor</th>
            <th>Status</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="tabular-nums">
                {format(parseISO(a.scheduledAt), "MMM d, HH:mm")}
              </td>
              <td>{doctorName(doctors, a.doctorId)}</td>
              <td>
                <span className={`pbi-status-pill ${STATUS_CLASS[a.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                  {a.status.replace("_", " ")}
                </span>
              </td>
              <td className="text-[#929296]">{a.durationMinutes} min</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
      trend: buildAppointmentTrendOption(appointments),
      status: buildStatusDonutOption(appointments),
      doctors: buildDoctorWorkloadOption(appointments, doctors),
    }),
    [appointments, doctors],
  );

  const recent = useMemo(
    () =>
      [...appointments]
        .sort(
          (a, b) =>
            parseISO(b.scheduledAt).getTime() - parseISO(a.scheduledAt).getTime(),
        )
        .slice(0, 8),
    [appointments],
  );

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={() => void reload()} />;

  const kpiTiles = [
    { label: "Today", value: kpis.todayCount, hint: "Scheduled today", icon: Calendar, accent: "brand" as const },
    { label: "Pending", value: kpis.pendingCount, hint: "Requested or confirmed", icon: Clock, accent: "warning" as const },
    { label: "Completed", value: kpis.completed30d, hint: `${kpis.completionRate}% completion rate`, icon: CheckCircle, accent: "success" as const },
    { label: "Staff", value: kpis.staffCount, hint: `${kpis.doctorCount} doctors`, icon: Users, accent: "neutral" as const },
  ];

  return (
    <div className="pbi-canvas space-y-5">
      <DashboardEntrance delay={DASHBOARD_MOTION.headerDelayMs}>
        <PageHeader
          title={clinic?.name ?? "Clinic overview"}
          subtitle="Last 30 days · your clinic only (tenant-scoped)"
          actions={
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard/analytics"
                className="text-xs font-semibold text-[#0066ff] hover:underline hidden sm:inline"
              >
                Full analytics
              </Link>
              <Button
              type="button"
              size="sm"
              onClick={() => void reload()}
              className="bg-[#0066ff] hover:bg-[#0052cc] text-white rounded-sm h-9 px-4 text-xs font-semibold shadow-none"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
            </div>
          }
        />
      </DashboardEntrance>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpiTiles.map((tile, index) => (
          <DashboardEntrance
            key={tile.label}
            variant="scale"
            delay={dashboardStaggerDelay(DASHBOARD_MOTION.kpiBaseDelayMs, index)}
            className="h-full"
          >
            <KpiTile {...tile} />
          </DashboardEntrance>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-8">
          <DashboardEntrance delay={DASHBOARD_MOTION.chartBaseDelayMs}>
            <VisualCard
              title="Appointment trend"
              subtitle="Daily volume by status (14 days)"
              option={charts.trend}
              height={320}
            />
          </DashboardEntrance>
        </div>
        <div className="xl:col-span-4">
          <DashboardEntrance
            delay={dashboardStaggerDelay(DASHBOARD_MOTION.chartBaseDelayMs, 1, DASHBOARD_MOTION.chartStaggerMs)}
          >
            <VisualCard
              title="Status mix"
              subtitle="Share of all appointments"
              option={charts.status}
              height={320}
            />
          </DashboardEntrance>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-5">
          <DashboardEntrance delay={DASHBOARD_MOTION.panelBaseDelayMs}>
            <VisualCard
              title="Doctor workload"
              subtitle="Appointments per doctor"
              option={charts.doctors}
              height={280}
            />
          </DashboardEntrance>
        </div>
        <div className="xl:col-span-7">
          <DashboardEntrance
            delay={dashboardStaggerDelay(DASHBOARD_MOTION.panelBaseDelayMs, 1, DASHBOARD_MOTION.panelStaggerMs)}
          >
            <PanelCard
              title="Recent appointments"
              subtitle="Latest bookings in your clinic"
              actions={
                <Link
                  to="/dashboard/appointments"
                  className="text-xs font-semibold text-[#0066ff] hover:underline"
                >
                  View all
                </Link>
              }
              noPadding
            >
              <RecentAppointmentsTable rows={recent} doctors={doctors} />
            </PanelCard>
          </DashboardEntrance>
        </div>
      </div>
    </div>
  );
}
