import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Activity,
  CalendarRange,
  Download,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiTile } from "@/components/layout/KpiTile";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageError, PageLoading } from "@/components/layout/PageState";
import { PanelCard } from "@/components/layout/PanelCard";
import { VisualCard } from "@/components/layout/VisualCard";
import { TenantScopeBadge } from "@/components/layout/TenantScopeBadge";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { useClinicAnalytics } from "@/hooks/useClinicAnalytics";
import {
  buildAppointmentTrendOption,
  buildDoctorWorkloadOption,
  buildPeakHoursOption,
  buildStaffRoleOption,
  buildStatusDonutOption,
  buildUniquePatientsOption,
  computeAnalyticsMetrics,
} from "@/lib/charts/clinicChartBuilders";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

function exportAppointmentsCsv(
  appointments: { scheduledAt: string; status: string; doctorId: string; patientId: string }[],
  clinicName: string,
) {
  const header = "date,time,status,doctorId,patientId";
  const rows = appointments.map((a) => {
    const dt = parseISO(a.scheduledAt);
    return [
      format(dt, "yyyy-MM-dd"),
      format(dt, "HH:mm"),
      a.status,
      a.doctorId,
      a.patientId,
    ].join(",");
  });
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${clinicName.replace(/\s+/g, "-").toLowerCase()}-analytics.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsPage() {
  const { clinic, staff, doctors, clinicId, loading: ctxLoading, error: ctxError, reload: ctxReload } =
    useClinicAdmin();
  const [days, setDays] = useState<number>(30);
  const { appointments, loading, error, reload } = useClinicAnalytics(clinicId, days);

  const metrics = useMemo(
    () => computeAnalyticsMetrics(appointments, days),
    [appointments, days],
  );

  const charts = useMemo(
    () => ({
      trend: buildAppointmentTrendOption(appointments, Math.min(days, 30)),
      status: buildStatusDonutOption(appointments),
      doctors: buildDoctorWorkloadOption(appointments, doctors),
      peak: buildPeakHoursOption(appointments),
      patients: buildUniquePatientsOption(appointments, Math.min(days, 30)),
      staff: buildStaffRoleOption(staff),
    }),
    [appointments, doctors, staff, days],
  );

  if (ctxLoading && !clinicId) return <PageLoading label="Loading clinic workspace…" />;
  if (ctxError) return <PageError message={ctxError} onRetry={() => void ctxReload()} />;

  const kpiTiles = [
    {
      label: "Appointments",
      value: metrics.total,
      hint: `${days}-day window`,
      icon: CalendarRange,
      accent: "brand" as const,
    },
    {
      label: "Unique patients",
      value: metrics.uniquePatients,
      hint: "Distinct patient IDs",
      icon: Users,
      accent: "neutral" as const,
    },
    {
      label: "Daily average",
      value: metrics.avgPerDay,
      hint: "Appointments per day",
      icon: TrendingUp,
      accent: "success" as const,
    },
    {
      label: "Completion",
      value: `${metrics.completionRate}%`,
      hint: `${metrics.completed} completed`,
      icon: UserCheck,
      accent: "success" as const,
    },
    {
      label: "No-show rate",
      value: `${metrics.noShowRate}%`,
      hint: "Missed appointments",
      icon: Activity,
      accent: "warning" as const,
    },
  ];

  return (
    <div className="pbi-canvas space-y-5">
      <PageHeader
        title="Analytics"
        subtitle={`Insights for ${clinic?.name ?? "your clinic"} · tenant-scoped data only`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TenantScopeBadge clinicName={clinic?.name} className="md:inline-flex" />
            <div className="flex rounded-sm border border-[#edebe9] p-0.5 bg-[#faf9f8]">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDays(opt.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors",
                    days === opt.value
                      ? "bg-white text-[#0066ff] shadow-sm"
                      : "text-[#929296] hover:text-[#1a1b1e]",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={appointments.length === 0}
              onClick={() =>
                exportAppointmentsCsv(appointments, clinic?.name ?? "clinic")
              }
              className="h-9 rounded-sm text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void reload()}
              disabled={loading}
              className="bg-[#0066ff] hover:bg-[#0052cc] text-white rounded-sm h-9 px-4 text-xs font-semibold shadow-none"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {error && <PageError message={error} onRetry={() => void reload()} />}

      {loading ? (
        <PageLoading label="Loading analytics…" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {kpiTiles.map((tile) => (
              <KpiTile key={tile.label} {...tile} />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-8">
              <VisualCard
                title="Appointment trend"
                subtitle={`Daily volume by status (${Math.min(days, 30)} days)`}
                option={charts.trend}
                height={320}
              />
            </div>
            <div className="xl:col-span-4">
              <VisualCard
                title="Status mix"
                subtitle="Share of appointments in range"
                option={charts.status}
                height={320}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <VisualCard
              title="Peak hours"
              subtitle="Busiest times of day"
              option={charts.peak}
              height={280}
            />
            <VisualCard
              title="Unique patients"
              subtitle="Distinct patients per day"
              option={charts.patients}
              height={280}
            />
            <VisualCard
              title="Staff composition"
              subtitle="Roles in your clinic"
              option={charts.staff}
              height={280}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-5">
              <VisualCard
                title="Doctor workload"
                subtitle="Appointments per doctor"
                option={charts.doctors}
                height={300}
              />
            </div>
            <div className="xl:col-span-7">
              <PanelCard
                title="Operational summary"
                subtitle={`Last ${days} days · ${clinic?.name ?? "clinic"}`}
              >
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3">
                    <dt className="text-[10px] font-bold uppercase text-[#929296]">
                      Cancellation rate
                    </dt>
                    <dd className="text-2xl font-semibold tabular-nums mt-1">
                      {metrics.cancellationRate}%
                    </dd>
                  </div>
                  <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3">
                    <dt className="text-[10px] font-bold uppercase text-[#929296]">
                      Staff on roster
                    </dt>
                    <dd className="text-2xl font-semibold tabular-nums mt-1">{staff.length}</dd>
                  </div>
                  <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3">
                    <dt className="text-[10px] font-bold uppercase text-[#929296]">Doctors</dt>
                    <dd className="text-2xl font-semibold tabular-nums mt-1">{doctors.length}</dd>
                  </div>
                  <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3">
                    <dt className="text-[10px] font-bold uppercase text-[#929296]">
                      Clinic tenant ID
                    </dt>
                    <dd className="text-xs font-mono mt-1 truncate" title={clinicId ?? undefined}>
                      {clinicId ?? "—"}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-[#929296] mt-4 leading-relaxed">
                  All metrics are computed from appointments belonging to this clinic only.
                  Multi-tenant isolation is enforced by your clinic ID and server-side tenant
                  headers.
                </p>
              </PanelCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
