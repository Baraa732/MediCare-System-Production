import type { EChartsOption } from "echarts";
import { format, parseISO, subDays, eachDayOfInterval, startOfDay } from "date-fns";
import type {
  ApiAppointment,
  ClinicDoctor,
  StaffMember,
} from "@/lib/api/types";

const BRAND = "#0066ff";
const STATUS_COLORS: Record<string, string> = {
  REQUESTED: "#f59e0b",
  CONFIRMED: BRAND,
  COMPLETED: "#10b981",
  CANCELLED: "#ef4444",
  NO_SHOW: "#8b5cf6",
};

const CHART_TOOLTIP = {
  backgroundColor: "rgba(255,255,255,0.98)",
  borderColor: "#e5e7eb",
  borderWidth: 1,
  textStyle: { color: "#1a1b1e", fontSize: 12 },
  padding: [10, 12],
  extraCssText: "box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-radius: 6px;",
};

function doctorLabel(doctors: ClinicDoctor[], id: string) {
  const d = doctors.find((x) => x.userId === id);
  if (!d) return "Unassigned";
  return d.fullName ?? (`${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || "Doctor");
}

/** 14-day stacked area — appointment volume by status */
export function buildAppointmentTrendOption(
  appointments: ApiAppointment[],
): EChartsOption {
  const end = startOfDay(new Date());
  const start = subDays(end, 13);
  const days = eachDayOfInterval({ start, end });
  const statuses = ["CONFIRMED", "COMPLETED", "REQUESTED", "CANCELLED", "NO_SHOW"];

  const dayKeys = days.map((d) => format(d, "yyyy-MM-dd"));
  const matrix = dayKeys.map(() =>
    Object.fromEntries(statuses.map((s) => [s, 0])) as Record<string, number>,
  );

  appointments.forEach((a) => {
    const key = format(parseISO(a.scheduledAt), "yyyy-MM-dd");
    const idx = dayKeys.indexOf(key);
    if (idx >= 0) matrix[idx][a.status] = (matrix[idx][a.status] ?? 0) + 1;
  });

  return {
    tooltip: { trigger: "axis", ...CHART_TOOLTIP },
    legend: {
      bottom: 0,
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: "#6b7280", fontSize: 11 },
    },
    grid: { left: 44, right: 16, top: 20, bottom: 48 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: dayKeys.map((k) => format(parseISO(k), "MMM d")),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#929296", fontSize: 11 },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#f0f0f0" } },
      axisLabel: { color: "#929296", fontSize: 11 },
    },
    series: statuses.map((status) => ({
      name: status.replace("_", " "),
      type: "line" as const,
      stack: "volume",
      smooth: true,
      symbol: "circle",
      symbolSize: 4,
      showSymbol: false,
      areaStyle: { opacity: 0.35 },
      emphasis: { focus: "series" as const },
      data: matrix.map((row) => row[status] ?? 0),
      itemStyle: { color: STATUS_COLORS[status] },
      lineStyle: { width: 2 },
    })),
  };
}

/** Donut — share of appointments by status (last 30d window) */
export function buildStatusDonutOption(
  appointments: ApiAppointment[],
): EChartsOption {
  const counts = appointments.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(counts).map(([name, value]) => ({
    name: name.replace("_", " "),
    value,
    itemStyle: { color: STATUS_COLORS[name] ?? "#9ca3af" },
  }));

  if (data.length === 0) {
    data.push({ name: "No data", value: 1, itemStyle: { color: "#e5e7eb" } });
  }

  const total = appointments.length;

  return {
    tooltip: { trigger: "item", ...CHART_TOOLTIP },
    series: [
      {
        type: "pie",
        radius: ["52%", "78%"],
        center: ["50%", "46%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: 600 },
        },
        data,
      },
    ],
    graphic: [
      {
        type: "text",
        left: "center",
        top: "40%",
        style: {
          text: String(total),
          fill: "#1a1b1e",
          fontSize: 28,
          fontWeight: 700,
        },
      },
      {
        type: "text",
        left: "center",
        top: "50%",
        style: {
          text: "Total",
          fill: "#929296",
          fontSize: 12,
        },
      },
    ],
  };
}

/** Horizontal bar — workload per doctor */
export function buildDoctorWorkloadOption(
  appointments: ApiAppointment[],
  doctors: ClinicDoctor[],
): EChartsOption {
  const byDoctor = appointments.reduce<Record<string, number>>((acc, a) => {
    acc[a.doctorId] = (acc[a.doctorId] ?? 0) + 1;
    return acc;
  }, {});

  const rows = Object.entries(byDoctor)
    .map(([id, value]) => ({ name: doctorLabel(doctors, id), value }))
    .sort((a, b) => a.value - b.value)
    .slice(-8);

  if (rows.length === 0) {
    rows.push({ name: "No appointments yet", value: 0 });
  }

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      ...CHART_TOOLTIP,
    },
    grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#f0f0f0", type: "dashed" } },
      axisLabel: { color: "#929296", fontSize: 11 },
    },
    yAxis: {
      type: "category",
      data: rows.map((r) => r.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#1a1b1e", fontSize: 12, width: 120, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: rows.map((r) => r.value),
        barMaxWidth: 18,
        itemStyle: {
          color: BRAND,
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: "right",
          color: "#6b7280",
          fontSize: 11,
        },
      },
    ],
  };
}

export function computeKpis(
  appointments: ApiAppointment[],
  staff: StaffMember[],
  doctors: ClinicDoctor[],
) {
  const today = format(new Date(), "yyyy-MM-dd");
  const todayCount = appointments.filter(
    (a) => format(parseISO(a.scheduledAt), "yyyy-MM-dd") === today,
  ).length;
  const completed = appointments.filter((a) => a.status === "COMPLETED").length;
  const pending = appointments.filter(
    (a) => a.status === "REQUESTED" || a.status === "CONFIRMED",
  ).length;
  const total = appointments.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    todayCount,
    completed30d: completed,
    pendingCount: pending,
    staffCount: staff.length,
    doctorCount: doctors.length,
    totalAppointments: total,
    completionRate,
  };
}
