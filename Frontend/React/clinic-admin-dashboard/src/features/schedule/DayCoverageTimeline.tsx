import { Clock3, Stethoscope } from "lucide-react";
import type { AvailabilitySlot, ClinicHoursDay } from "@/lib/api/schedule";
import { cn } from "@/lib/utils";
import {
  DOCTOR_LANE_COLORS,
  buildHourTicks,
  minutesToLabel,
  timeToMinutes,
} from "./scheduleUtils";

type DayCoverageTimelineProps = {
  dayLabel: string;
  dayHours?: ClinicHoursDay;
  slots: AvailabilitySlot[];
  doctorName: (id: string) => string;
  loading?: boolean;
};

type Lane = {
  doctorId: string;
  name: string;
  color: string;
  slots: AvailabilitySlot[];
};

export function DayCoverageTimeline({
  dayLabel,
  dayHours,
  slots,
  doctorName,
  loading,
}: DayCoverageTimelineProps) {
  const closed = Boolean(dayHours?.isClosed);
  const openMin = timeToMinutes(dayHours?.openTime ?? "09:00");
  const closeMin = timeToMinutes(dayHours?.closeTime ?? "17:00");
  const rangeStart = closed ? 9 * 60 : openMin;
  const rangeEnd = closed ? 17 * 60 : Math.max(closeMin, openMin + 60);
  const span = Math.max(60, rangeEnd - rangeStart);
  const ticks = buildHourTicks(dayHours?.openTime, dayHours?.closeTime, closed);

  const lanes: Lane[] = (() => {
    const map = new Map<string, AvailabilitySlot[]>();
    for (const slot of slots) {
      const list = map.get(slot.doctorId) ?? [];
      list.push(slot);
      map.set(slot.doctorId, list);
    }
    return Array.from(map.entries()).map(([doctorId, doctorSlots], index) => ({
      doctorId,
      name: doctorName(doctorId),
      color: DOCTOR_LANE_COLORS(index),
      slots: doctorSlots,
    }));
  })();

  const pct = (minutes: number) =>
    `${Math.min(100, Math.max(0, ((minutes - rangeStart) / span) * 100))}%`;

  return (
    <section className="pbi-panel">
      <header className="pbi-panel-header">
        <div className="min-w-0">
          <h2 className="pbi-panel-title">{dayLabel}</h2>
          <p className="pbi-panel-subtitle">
            Doctor coverage within clinic hours — glanceable day capacity
          </p>
        </div>
        {!closed && (
          <span className="pbi-status-pill bg-[#ecf3ff] text-[#0066ff]">
            {dayHours?.openTime} – {dayHours?.closeTime}
          </span>
        )}
      </header>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center gap-3 py-10 text-sm text-[#929296]">
            <div className="pbi-spinner" />
            Loading coverage…
          </div>
        ) : closed ? (
          <div className="flex items-center gap-3 rounded-sm border border-dashed border-[#e1dfdd] bg-[#faf9f8] px-4 py-8 text-sm text-[#929296]">
            <Clock3 className="w-5 h-5 shrink-0" />
            Clinic is closed this weekday. Open the day in operating hours to enable booking.
          </div>
        ) : lanes.length === 0 ? (
          <div className="flex items-center gap-3 rounded-sm border border-dashed border-[#c7dcff] bg-[#ecf3ff]/40 px-4 py-8 text-sm text-[#1a1b1e]">
            <Stethoscope className="w-5 h-5 text-[#0066ff] shrink-0" />
            <div>
              <p className="font-semibold">No doctor coverage yet</p>
              <p className="text-xs text-[#929296] mt-0.5">
                Add a recurring doctor slot for this weekday so secretaries can book visits.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative ml-[120px] h-6">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute -translate-x-1/2 text-[10px] font-semibold text-[#929296] tabular-nums"
                  style={{ left: pct(t) }}
                >
                  {minutesToLabel(t)}
                </span>
              ))}
            </div>

            <div className="space-y-2.5">
              {lanes.map((lane) => (
                <div key={lane.doctorId} className="flex items-stretch gap-3">
                  <div className="w-[108px] shrink-0 pt-1">
                    <p className="text-xs font-semibold text-[#1a1b1e] truncate" title={lane.name}>
                      {lane.name}
                    </p>
                    <p className="text-[10px] text-[#929296] mt-0.5">
                      {lane.slots.length} slot{lane.slots.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="relative flex-1 h-11 rounded-sm bg-[#f3f2f1] border border-[#edebe9] overflow-hidden">
                    {/* Clinic open window highlight */}
                    <div
                      className="absolute inset-y-0 bg-white"
                      style={{ left: pct(openMin), width: `calc(${pct(closeMin)} - ${pct(openMin)})` }}
                    />
                    {ticks.map((t) => (
                      <div
                        key={`${lane.doctorId}-${t}`}
                        className="absolute top-0 bottom-0 w-px bg-[#edebe9]"
                        style={{ left: pct(t) }}
                      />
                    ))}
                    {lane.slots.map((slot) => {
                      const start = timeToMinutes(slot.startTime);
                      const end = timeToMinutes(slot.endTime);
                      return (
                        <div
                          key={slot.id}
                          title={`${lane.name}: ${slot.startTime}–${slot.endTime}`}
                          className={cn(
                            "absolute top-1.5 bottom-1.5 rounded-sm border text-[10px] font-semibold text-white px-1.5 flex items-center overflow-hidden shadow-sm",
                          )}
                          style={{
                            left: pct(start),
                            width: `calc(${pct(end)} - ${pct(start)})`,
                            backgroundColor: lane.color,
                            borderColor: lane.color,
                          }}
                        >
                          <span className="truncate tabular-nums">
                            {slot.startTime}–{slot.endTime}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[#929296]">
              Colored blocks = recurring doctor availability. White track = clinic open window.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
