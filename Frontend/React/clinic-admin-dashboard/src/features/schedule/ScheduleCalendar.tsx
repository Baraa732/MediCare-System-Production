import { useEffect, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
} from "@fullcalendar/core";
import type {
  AvailabilitySlot,
  ClinicHoursDay,
  ScheduleBlock,
} from "@/lib/api/schedule";
import { buildCalendarEvents, DOCTOR_COLORS } from "./scheduleUtils";

type ScheduleCalendarProps = {
  hours: ClinicHoursDay[];
  availability: AvailabilitySlot[];
  blocks: ScheduleBlock[];
  doctorName: (id: string) => string;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onDatesSet: (start: Date, end: Date) => void;
  onSelectSlotDay: (date: Date) => void;
};

function EventContent(arg: EventContentArg) {
  if (arg.event.display === "background") return true;
  const start = arg.event.extendedProps.startTime as string | undefined;
  const end = arg.event.extendedProps.endTime as string | undefined;
  return (
    <div className="fc-medicare-event px-1 py-0.5 leading-tight overflow-hidden h-full border-l-[3px] border-l-white/40">
      <div className="text-[11px] font-semibold truncate">{arg.event.title}</div>
      {start && end && (
        <div className="text-[10px] opacity-90 tabular-nums truncate">
          {start}–{end}
        </div>
      )}
    </div>
  );
}

export function ScheduleCalendar({
  hours,
  availability,
  blocks,
  doctorName,
  selectedDate,
  onDateChange,
  onDatesSet,
  onSelectSlotDay,
}: ScheduleCalendarProps) {
  const calendarRef = useRef<FullCalendar | null>(null);

  const doctorColorIndex = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const slot of availability) {
      if (!map.has(slot.doctorId)) map.set(slot.doctorId, i++);
    }
    return map;
  }, [availability]);

  const events = useMemo(() => {
    const padStart = new Date(selectedDate);
    padStart.setDate(padStart.getDate() - 21);
    const padEnd = new Date(selectedDate);
    padEnd.setDate(padEnd.getDate() + 28);
    return buildCalendarEvents({
      rangeStart: padStart,
      rangeEnd: padEnd,
      hours,
      availability,
      blocks,
      doctorName,
      doctorColorIndex,
    });
  }, [selectedDate, hours, availability, blocks, doctorName, doctorColorIndex]);

  const legend = useMemo(() => {
    const ids = [...doctorColorIndex.entries()].sort((a, b) => a[1] - b[1]);
    return ids.map(([id, idx]) => ({
      id,
      name: doctorName(id),
      color: DOCTOR_COLORS(idx),
    }));
  }, [doctorColorIndex, doctorName]);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const current = api.getDate();
    if (
      current.getFullYear() !== selectedDate.getFullYear() ||
      current.getMonth() !== selectedDate.getMonth() ||
      current.getDate() !== selectedDate.getDate()
    ) {
      api.gotoDate(selectedDate);
    }
  }, [selectedDate]);

  return (
    <section className="pbi-panel overflow-hidden">
      <header className="pbi-panel-header">
        <div className="min-w-0">
          <h2 className="pbi-panel-title">Coverage calendar</h2>
          <p className="pbi-panel-subtitle">
            Blue wash = clinic open · colored = coverage · gray = closed / blocked
          </p>
        </div>
        {legend.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end max-w-[55%]">
            {legend.slice(0, 6).map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#1a1b1e]"
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate max-w-[88px]">{item.name}</span>
              </span>
            ))}
          </div>
        )}
      </header>
      <div className="fc-medicare p-2 sm:p-3">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          initialDate={selectedDate}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridWeek,timeGridDay,dayGridMonth",
          }}
          buttonText={{
            today: "Today",
            week: "Week",
            day: "Day",
            month: "Month",
          }}
          height="min(68vh, 720px)"
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          nowIndicator
          weekends
          editable={false}
          selectable
          selectMirror
          dayMaxEvents
          events={events}
          eventContent={EventContent}
          datesSet={(arg: DatesSetArg) => {
            onDatesSet(arg.start, arg.end);
          }}
          dateClick={(arg) => {
            onDateChange(arg.date);
            onSelectSlotDay(arg.date);
          }}
          eventClick={(arg: EventClickArg) => {
            if (arg.event.start) onDateChange(arg.event.start);
          }}
          slotLabelFormat={{
            hour: "numeric",
            minute: "2-digit",
            omitZeroMinute: true,
            meridiem: "short",
          }}
        />
      </div>
    </section>
  );
}
