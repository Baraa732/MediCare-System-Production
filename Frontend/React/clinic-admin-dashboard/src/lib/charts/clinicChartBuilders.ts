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

function doctorLabel(doctors: ClinicDoctor[], id: string) {
  const d = doctors.find((x) => x.userId === id);
  if (!d) return "Unknown";
  return d.fullName ?? (`${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || "Doctor");
}

export function buildSankeyOption(
  appointments: ApiAppointment[],
): EChartsOption {
  const statusCounts = appointments.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const requested = statusCounts.REQUESTED ?? 0;
  const confirmed = statusCounts.CONFIRMED ?? 0;
  const completed = statusCounts.COMPLETED ?? 0;
  const cancelled = statusCounts.CANCELLED ?? 0;
  const noShow = statusCounts.NO_SHOW ?? 0;

  const nodes = [
    { name: "All bookings" },
    { name: "Requested" },
    { name: "Confirmed" },
    { name: "Completed" },
    { name: "Cancelled" },
    { name: "No-show" },
  ];

  const links = [
    { source: "All bookings", target: "Requested", value: requested || 1 },
    { source: "All bookings", target: "Confirmed", value: confirmed },
    { source: "Confirmed", target: "Completed", value: completed },
    { source: "Confirmed", target: "Cancelled", value: cancelled },
    { source: "Confirmed", target: "No-show", value: noShow },
  ].filter((l) => l.value > 0);

  return {
    color: [BRAND, "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"],
    tooltip: { trigger: "item", triggerOn: "mousemove" },
    series: [
      {
        type: "sankey",
        emphasis: { focus: "adjacency" },
        data: nodes,
        links,
        lineStyle: { color: "gradient", curveness: 0.5 },
        label: { color: "#1A1B1E", fontSize: 12 },
      },
    ],
  };
}

export function buildTreemapOption(
  appointments: ApiAppointment[],
  doctors: ClinicDoctor[],
): EChartsOption {
  const byDoctor = appointments.reduce<Record<string, number>>((acc, a) => {
    acc[a.doctorId] = (acc[a.doctorId] ?? 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(byDoctor).map(([id, value]) => ({
    name: doctorLabel(doctors, id),
    value,
  }));

  if (data.length === 0) {
    data.push({ name: "No appointments", value: 1 });
  }

  return {
    color: [BRAND, "#06b6d4", "#8b5cf6", "#10b981", "#f59e0b"],
    tooltip: { formatter: "{b}: {c} appointments" },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: { show: true, formatter: "{b}\n{c}" },
        itemStyle: { borderColor: "#fff", borderWidth: 2, gapWidth: 2 },
        data,
      },
    ],
  };
}

export function buildStreamgraphOption(
  appointments: ApiAppointment[],
): EChartsOption {
  const end = startOfDay(new Date());
  const start = subDays(end, 13);
  const days = eachDayOfInterval({ start, end });
  const statuses = ["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

  const dayKeys = days.map((d) => format(d, "yyyy-MM-dd"));
  const matrix = dayKeys.map(() =>
    statuses.reduce<Record<string, number>>((acc, s) => {
      acc[s] = 0;
      return acc;
    }, {}),
  );

  appointments.forEach((a) => {
    const key = format(parseISO(a.scheduledAt), "yyyy-MM-dd");
    const idx = dayKeys.indexOf(key);
    if (idx >= 0) matrix[idx][a.status] = (matrix[idx][a.status] ?? 0) + 1;
  });

  const series = statuses.map((status) => ({
    name: status.replace("_", " "),
    type: "line" as const,
    stack: "total",
    areaStyle: {},
    smooth: true,
    symbol: "none",
    emphasis: { focus: "series" as const },
    data: matrix.map((row) => row[status] ?? 0),
    itemStyle: { color: STATUS_COLORS[status] },
  }));

  return {
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, textStyle: { color: "#929296" } },
    grid: { left: 40, right: 16, top: 24, bottom: 48 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: dayKeys.map((k) => format(parseISO(k), "MMM d")),
      axisLine: { lineStyle: { color: "#e5e5e5" } },
      axisLabel: { color: "#929296" },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f0f0f0" } },
      axisLabel: { color: "#929296" },
    },
    series,
  };
}

export function buildParallelOption(
  appointments: ApiAppointment[],
  doctors: ClinicDoctor[],
): EChartsOption {
  const metrics = doctors.map((d) => {
    const mine = appointments.filter((a) => a.doctorId === d.userId);
    const total = mine.length || 1;
    const completed = mine.filter((a) => a.status === "COMPLETED").length;
    const cancelled = mine.filter((a) => a.status === "CANCELLED").length;
    const avgDuration =
      mine.reduce((s, a) => s + a.durationMinutes, 0) / (mine.length || 1);
    return [
      total,
      Math.round((completed / total) * 100),
      Math.round((cancelled / total) * 100),
      Math.round(avgDuration),
    ];
  });

  if (metrics.length === 0) {
    metrics.push([0, 0, 0, 30]);
  }

  return {
    parallelAxis: [
      { dim: 0, name: "Bookings", min: 0 },
      { dim: 1, name: "Completed %", min: 0, max: 100 },
      { dim: 2, name: "Cancelled %", min: 0, max: 100 },
      { dim: 3, name: "Avg min", min: 0, max: 120 },
    ],
    parallel: {
      left: 60,
      right: 40,
      bottom: 30,
      top: 40,
      parallelAxisDefault: {
        nameTextStyle: { color: "#929296" },
        axisLine: { lineStyle: { color: "#e5e5e5" } },
        axisLabel: { color: "#929296" },
      },
    },
    series: [
      {
        type: "parallel",
        lineStyle: { width: 2, opacity: 0.7, color: BRAND },
        data: metrics,
      },
    ],
  };
}

export function buildChordOption(
  staff: StaffMember[],
  appointments: ApiAppointment[],
): EChartsOption {
  const roles = [...new Set(staff.map((s) => s.staffRole))];
  if (roles.length === 0) roles.push("DOCTOR", "SECRETARY", "CLINIC_ADMIN");

  const roleIndex = Object.fromEntries(roles.map((r, i) => [r, i]));
  const matrix = roles.map(() => roles.map(() => 0));

  staff.forEach((member) => {
    const ri = roleIndex[member.staffRole];
    if (ri === undefined) return;
    const relatedAppts = appointments.filter(
      (a) => a.doctorId === member.userId,
    ).length;
    roles.forEach((_, ci) => {
      matrix[ri][ci] += relatedAppts > 0 ? Math.ceil(relatedAppts / roles.length) : 1;
    });
  });

  return {
    tooltip: {},
    series: [
      {
        type: "graph",
        layout: "circular",
        roam: false,
        label: { show: true, color: "#1A1B1E" },
        circular: { rotateLabel: true },
        data: roles.map((name) => ({
          name,
          symbolSize: 36,
          itemStyle: { color: BRAND },
        })),
        links: (() => {
          const links: { source: string; target: string; value: number }[] = [];
          for (let i = 0; i < roles.length; i++) {
            for (let j = i + 1; j < roles.length; j++) {
              const value = matrix[i][j] + matrix[j][i];
              if (value > 0) {
                links.push({
                  source: roles[i],
                  target: roles[j],
                  value,
                });
              }
            }
          }
          return links.length
            ? links
            : [{ source: roles[0], target: roles[1] ?? roles[0], value: 1 }];
        })(),
        lineStyle: { color: "source", curveness: 0.25, opacity: 0.6 },
        emphasis: { focus: "adjacency" },
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

  return {
    todayCount,
    completed30d: completed,
    pendingCount: pending,
    staffCount: staff.length,
    doctorCount: doctors.length,
    totalAppointments: appointments.length,
  };
}

export function buildGaugeOption(appointments: ApiAppointment[]): EChartsOption {
  const total = appointments.length || 1;
  const completed = appointments.filter((a) => a.status === "COMPLETED").length;
  const rate = Math.round((completed / total) * 100);

  return {
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        progress: { show: true, width: 14 },
        axisLine: { lineStyle: { width: 14 } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        detail: {
          valueAnimation: true,
          formatter: "{value}%",
          fontSize: 28,
          fontWeight: "bold",
          color: BRAND,
          offsetCenter: [0, "10%"],
        },
        data: [{ value: rate, name: "Completion" }],
        title: { offsetCenter: [0, "40%"], fontSize: 14, color: "#929296" },
      },
    ],
  };
}

export function buildHeatmapOption(appointments: ApiAppointment[]): EChartsOption {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = ["8h", "10h", "12h", "14h", "16h", "18h"];
  const data: [number, number, number][] = [];

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 6; h++) {
      const hourStart = 8 + h * 2;
      const count = appointments.filter((a) => {
        const dt = parseISO(a.scheduledAt);
        return dt.getDay() === d && dt.getHours() >= hourStart && dt.getHours() < hourStart + 2;
      }).length;
      data.push([h, d, count]);
    }
  }

  const maxVal = Math.max(...data.map((d) => d[2]), 1);

  return {
    tooltip: { position: "top" },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: "category",
      data: hours,
      splitArea: { show: true },
      axisLabel: { color: "#929296" },
    },
    yAxis: {
      type: "category",
      data: days,
      splitArea: { show: true },
      axisLabel: { color: "#929296" },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: ["#ecf3ff", BRAND] },
      show: false,
    },
    series: [
      {
        type: "heatmap",
        data,
        label: { show: true, color: "#1A1B1E" },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.2)" } },
      },
    ],
  };
}
