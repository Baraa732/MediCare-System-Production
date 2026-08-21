import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Layers,
  ShieldOff,
} from "lucide-react";
import type {
  AvailabilitySlot,
  ClinicHoursDay,
  ScheduleBlock,
} from "@/lib/api/schedule";
import type { ApiAppointment } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DAY_SHORT,
  DOCTOR_COLORS,
  timeToMinutes,
} from "./scheduleUtils";

const DAY_START = 6 * 60;
const DAY_END = 22 * 60;
const DAY_SPAN = DAY_END - DAY_START;

type ScheduleCalendarProps = {
  hours: ClinicHoursDay[];
  availability: AvailabilitySlot[];
  blocks: ScheduleBlock[];
  appointments?: ApiAppointment[];
  doctorName: (id: string) => string;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onDatesSet: (start: Date, end: Date) => void;
  onSelectSlotDay: (date: Date) => void;
};

type LaneItem = {
  id: string;
  kind: "coverage" | "block" | "appointment";
  topPct: number;
  heightPct: number;
  label: string;
  sub?: string;
  color: string;
  doctorId?: string | null;
};

function clampMinutes(m: number) {
  return Math.max(DAY_START, Math.min(DAY_END, m));
}

function rangeToPct(startMin: number, endMin: number) {
  const s = clampMinutes(startMin);
  const e = clampMinutes(endMin);
  const topPct = ((s - DAY_START) / DAY_SPAN) * 100;
  const heightPct = Math.max(((e - s) / DAY_SPAN) * 100, 1.2);
  return { topPct, heightPct };
}

function hourTicks() {
  const ticks: number[] = [];
  for (let m = DAY_START; m <= DAY_END; m += 60) ticks.push(m);
  return ticks;
}

export function ScheduleCalendar({
  hours,
  availability,
  blocks,
  appointments = [],
  doctorName,
  selectedDate,
  onDateChange,
  onDatesSet,
  onSelectSlotDay,
}: ScheduleCalendarProps) {
  const [doctorFilter, setDoctorFilter] = useState<string>("ALL");
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 40);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const weekStart = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 0 }),
    [selectedDate],
  );
  const weekEnd = useMemo(
    () => endOfWeek(selectedDate, { weekStartsOn: 0 }),
    [selectedDate],
  );
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd],
  );

  useEffect(() => {
    onDatesSet(weekStart, addDays(weekEnd, 1));
    // Parent may pass an inline no-op; only re-fire when the week bounds change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, weekEnd]);

  const doctorColorIndex = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const slot of availability) {
      if (!map.has(slot.doctorId)) map.set(slot.doctorId, i++);
    }
    return map;
  }, [availability]);

  const legend = useMemo(() => {
    return [...doctorColorIndex.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([id, idx]) => ({
        id,
        name: doctorName(id),
        color: DOCTOR_COLORS(idx),
      }));
  }, [doctorColorIndex, doctorName]);

  const dayLanes = useMemo(() => {
    return weekDays.map((day) => {
      const dow = day.getDay();
      const dateKey = format(day, "yyyy-MM-dd");
      const dayHours = hours.find((h) => h.dayOfWeek === dow);
      const closedAllDay = Boolean(dayHours?.isClosed);
      const openMin = dayHours && !closedAllDay ? timeToMinutes(dayHours.openTime) : null;
      const closeMin = dayHours && !closedAllDay ? timeToMinutes(dayHours.closeTime) : null;

      const items: LaneItem[] = [];

      for (const slot of availability.filter((s) => s.dayOfWeek === dow)) {
        if (doctorFilter !== "ALL" && slot.doctorId !== doctorFilter) continue;
        const colorIdx = doctorColorIndex.get(slot.doctorId) ?? 0;
        const { topPct, heightPct } = rangeToPct(
          timeToMinutes(slot.startTime),
          timeToMinutes(slot.endTime),
        );
        items.push({
          id: `cov-${slot.id}-${dateKey}`,
          kind: "coverage",
          topPct,
          heightPct,
          label: doctorName(slot.doctorId),
          sub: `${slot.startTime}–${slot.endTime}`,
          color: DOCTOR_COLORS(colorIdx),
          doctorId: slot.doctorId,
        });
      }

      for (const block of blocks) {
        const start = new Date(block.startsAt);
        const end = new Date(block.endsAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);
        if (!(start < dayEnd && end > dayStart)) continue;

        if (doctorFilter !== "ALL" && block.doctorId && block.doctorId !== doctorFilter) {
          continue;
        }

        const clippedStart = start < dayStart ? dayStart : start;
        const clippedEnd = end > dayEnd ? dayEnd : end;
        const dayStartMin = clippedStart.getHours() * 60 + clippedStart.getMinutes();
        const dayEndMin = clippedEnd.getHours() * 60 + clippedEnd.getMinutes();
        const { topPct, heightPct } = rangeToPct(
          dayStartMin,
          Math.max(dayEndMin, dayStartMin + 15),
        );
        items.push({
          id: `blk-${block.id}-${dateKey}`,
          kind: "block",
          topPct,
          heightPct,
          label: block.reason?.trim() || (block.doctorId ? "Blocked" : "Clinic closed"),
          sub: block.doctorId ? doctorName(block.doctorId) : "Whole clinic",
          color: "#6b7280",
          doctorId: block.doctorId,
        });
      }

      for (const apt of appointments) {
        if (!apt.scheduledAt) continue;
        const when = parseISO(apt.scheduledAt);
        if (!isSameDay(when, day)) continue;
        if (doctorFilter !== "ALL" && apt.doctorId !== doctorFilter) continue;
        if (["CANCELLED", "NO_SHOW"].includes(apt.status)) continue;
        const startMin = when.getHours() * 60 + when.getMinutes();
        const endMin = startMin + (apt.durationMinutes || 30);
        const colorIdx = doctorColorIndex.get(apt.doctorId) ?? 0;
        const { topPct, heightPct } = rangeToPct(startMin, endMin);
        items.push({
          id: `apt-${apt.id}`,
          kind: "appointment",
          topPct,
          heightPct,
          label: apt.status.replace("_", " "),
          sub: doctorName(apt.doctorId),
          color: DOCTOR_COLORS(colorIdx),
          doctorId: apt.doctorId,
        });
      }

      return {
        day,
        dateKey,
        closedAllDay,
        openMin,
        closeMin,
        items,
        coverageCount: items.filter((i) => i.kind === "coverage").length,
        appointmentCount: items.filter((i) => i.kind === "appointment").length,
        blockCount: items.filter((i) => i.kind === "block").length,
      };
    });
  }, [
    weekDays,
    hours,
    availability,
    blocks,
    appointments,
    doctorFilter,
    doctorColorIndex,
    doctorName,
  ]);

  const densityOption = useMemo(() => {
    const categories = dayLanes.map((d) => DAY_SHORT[d.day.getDay()]);
    return {
      animationDuration: 700,
      animationEasing: "cubicOut",
      grid: { left: 8, right: 8, top: 28, bottom: 22, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255,255,255,0.98)",
        borderColor: "#e5e7eb",
        textStyle: { color: "#1a1b1e", fontSize: 12 },
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { fontSize: 11, color: "#929296" },
      },
      xAxis: {
        type: "category",
        data: categories,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#edebe9" } },
        axisLabel: { color: "#929296", fontSize: 11, fontWeight: 600 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: "#f3f2f1", type: "dashed" } },
        axisLabel: { color: "#929296", fontSize: 10 },
      },
      series: [
        {
          name: "Coverage",
          type: "bar",
          stack: "total",
          barWidth: 18,
          data: dayLanes.map((d) => d.coverageCount),
          itemStyle: {
            color: "#0066ff",
            borderRadius: [2, 2, 0, 0],
          },
          emphasis: { focus: "series" },
        },
        {
          name: "Visits",
          type: "bar",
          stack: "total",
          data: dayLanes.map((d) => d.appointmentCount),
          itemStyle: { color: "#0f766e" },
        },
        {
          name: "Closed",
          type: "bar",
          stack: "total",
          data: dayLanes.map((d) => d.blockCount),
          itemStyle: { color: "#9ca3af" },
        },
      ],
    };
  }, [dayLanes]);

  const weekStats = useMemo(() => {
    const coverage = dayLanes.reduce((n, d) => n + d.coverageCount, 0);
    const visits = dayLanes.reduce((n, d) => n + d.appointmentCount, 0);
    const closed = dayLanes.reduce((n, d) => n + d.blockCount, 0);
    const openDays = dayLanes.filter((d) => !d.closedAllDay).length;
    return { coverage, visits, closed, openDays };
  }, [dayLanes]);

  const shiftWeek = (delta: number) => {
    onDateChange(addDays(selectedDate, delta * 7));
  };

  const nowTopPct = (() => {
    const m = now.getHours() * 60 + now.getMinutes();
    if (m < DAY_START || m > DAY_END) return null;
    return ((m - DAY_START) / DAY_SPAN) * 100;
  })();

  const ticks = hourTicks();

  return (
    <section className="pbi-panel overflow-hidden coverage-board">
      <header className="pbi-panel-header gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="pbi-panel-title">Coverage calendar</h2>
          <p className="pbi-panel-subtitle">
            Live week board from clinic hours, doctor coverage, blocks, and visits
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <div className="inline-flex items-center rounded-sm border border-[#edebe9] bg-white">
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-8 rounded-sm p-0"
              onClick={() => shiftWeek(-1)}
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <button
              type="button"
              className="px-2 text-xs font-semibold tabular-nums text-[#1a1b1e] hover:text-[#0066ff]"
              onClick={() => onDateChange(new Date())}
            >
              {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d")}
            </button>
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-8 rounded-sm p-0"
              onClick={() => shiftWeek(1)}
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="h-8 rounded-sm border border-[#edebe9] bg-white px-2 text-xs font-medium"
          >
            <option value="ALL">All doctors</option>
            {legend.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="px-4 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Open days", value: weekStats.openDays, icon: Clock3 },
          { label: "Coverage blocks", value: weekStats.coverage, icon: Layers },
          { label: "Visits", value: weekStats.visits, icon: Clock3 },
          { label: "Closed / blocked", value: weekStats.closed, icon: ShieldOff },
        ].map((kpi, i) => (
          <div
            key={kpi.label}
            className={cn(
              "rounded-sm border border-[#f3f2f1] bg-[#faf9f8] px-3 py-2 coverage-kpi",
              mounted && "coverage-kpi-in",
            )}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#929296]">
              <kpi.icon className="w-3 h-3" />
              {kpi.label}
            </div>
            <p className="text-lg font-semibold tabular-nums text-[#1a1b1e] mt-0.5">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="px-4 pt-3">
        <div className="rounded-sm border border-[#f3f2f1] bg-white overflow-hidden">
          <ReactECharts
            option={densityOption}
            style={{ height: 140, width: "100%" }}
            opts={{ renderer: "canvas" }}
            notMerge
          />
        </div>
      </div>

      {legend.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {legend.slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                setDoctorFilter((prev) => (prev === item.id ? "ALL" : item.id))
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] font-semibold transition-all",
                doctorFilter === item.id
                  ? "border-[#0066ff] bg-[#ecf3ff] text-[#0066ff]"
                  : "border-[#edebe9] bg-white text-[#1a1b1e] hover:border-[#c8c6c4]",
              )}
            >
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 pt-3 overflow-x-auto">
        <div className="min-w-[720px] grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-2">
          <div className="pt-12" />
          {dayLanes.map((col, colIdx) => {
            const selected = isSameDay(col.day, selectedDate);
            const today = isToday(col.day);
            return (
              <button
                key={col.dateKey}
                type="button"
                onClick={() => {
                  onDateChange(col.day);
                  onSelectSlotDay(col.day);
                }}
                className={cn(
                  "rounded-sm border px-2 py-2 text-left transition-all duration-300 coverage-day-head",
                  mounted && "coverage-day-head-in",
                  selected
                    ? "border-[#0066ff] bg-[#ecf3ff] shadow-[0_0_0_1px_#0066ff33]"
                    : "border-[#edebe9] bg-white hover:border-[#c8c6c4]",
                  today && !selected && "bg-[#faf9f8]",
                )}
                style={{ animationDelay: `${80 + colIdx * 55}ms` }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#929296]">
                  {DAY_SHORT[col.day.getDay()]}
                </p>
                <p className="text-sm font-semibold tabular-nums text-[#1a1b1e]">
                  {format(col.day, "d MMM")}
                </p>
                <p className="text-[10px] text-[#929296] mt-0.5">
                  {col.closedAllDay
                    ? "Closed"
                    : col.openMin != null && col.closeMin != null
                      ? `${String(Math.floor(col.openMin / 60)).padStart(2, "0")}:${String(col.openMin % 60).padStart(2, "0")}–${String(Math.floor(col.closeMin / 60)).padStart(2, "0")}:${String(col.closeMin % 60).padStart(2, "0")}`
                      : "—"}
                </p>
              </button>
            );
          })}

          <div className="relative h-[520px] text-[10px] font-medium text-[#929296]">
            {ticks.map((m) => {
              const top = ((m - DAY_START) / DAY_SPAN) * 100;
              return (
                <div
                  key={m}
                  className="absolute right-1 -translate-y-1/2 tabular-nums"
                  style={{ top: `${top}%` }}
                >
                  {String(Math.floor(m / 60)).padStart(2, "0")}:00
                </div>
              );
            })}
          </div>

          {dayLanes.map((col, colIdx) => {
            const selected = isSameDay(col.day, selectedDate);
            const today = isToday(col.day);
            const openTop =
              col.openMin != null
                ? ((clampMinutes(col.openMin) - DAY_START) / DAY_SPAN) * 100
                : 0;
            const openHeight =
              col.openMin != null && col.closeMin != null
                ? ((clampMinutes(col.closeMin) - clampMinutes(col.openMin)) /
                    DAY_SPAN) *
                  100
                : 0;

            return (
              <div
                key={`lane-${col.dateKey}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onDateChange(col.day);
                  onSelectSlotDay(col.day);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onDateChange(col.day);
                    onSelectSlotDay(col.day);
                  }
                }}
                className={cn(
                  "relative h-[520px] rounded-sm border overflow-hidden cursor-pointer transition-colors duration-300 coverage-lane",
                  mounted && "coverage-lane-in",
                  selected ? "border-[#0066ff]/70 bg-[#fcfdff]" : "border-[#edebe9] bg-[#faf9f8]",
                  col.closedAllDay && "coverage-lane-closed",
                )}
                style={{ animationDelay: `${120 + colIdx * 60}ms` }}
              >
                {ticks.map((m) => {
                  const top = ((m - DAY_START) / DAY_SPAN) * 100;
                  return (
                    <div
                      key={`${col.dateKey}-${m}`}
                      className="absolute inset-x-0 border-t border-[#edebe9]/80"
                      style={{ top: `${top}%` }}
                    />
                  );
                })}

                {!col.closedAllDay && openHeight > 0 && (
                  <div
                    className="absolute inset-x-0 coverage-open-wash"
                    style={{ top: `${openTop}%`, height: `${openHeight}%` }}
                  />
                )}

                {col.closedAllDay && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#929296] rotate-[-18deg]">
                      Closed
                    </span>
                  </div>
                )}

                {col.items.map((item, itemIdx) => (
                  <div
                    key={item.id}
                    className={cn(
                      "absolute left-1 right-1 rounded-sm px-1.5 py-1 overflow-hidden coverage-chip",
                      mounted && "coverage-chip-in",
                      item.kind === "block" && "coverage-chip-block",
                      item.kind === "appointment" && "coverage-chip-apt",
                    )}
                    style={{
                      top: `${item.topPct}%`,
                      height: `${item.heightPct}%`,
                      backgroundColor:
                        item.kind === "block" ? "#6b7280" : item.color,
                      animationDelay: `${180 + colIdx * 40 + itemIdx * 35}ms`,
                    }}
                    title={`${item.label}${item.sub ? ` · ${item.sub}` : ""}`}
                  >
                    <p className="text-[10px] font-semibold text-white truncate leading-tight">
                      {item.label}
                    </p>
                    {item.heightPct > 6 && item.sub && (
                      <p className="text-[9px] text-white/85 truncate tabular-nums">
                        {item.sub}
                      </p>
                    )}
                  </div>
                ))}

                {today && nowTopPct != null && (
                  <div
                    className="absolute inset-x-0 z-20 coverage-now-line"
                    style={{ top: `${nowTopPct}%` }}
                  >
                    <span className="coverage-now-dot" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
