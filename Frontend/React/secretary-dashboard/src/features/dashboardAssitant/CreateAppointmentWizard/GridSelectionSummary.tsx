import { CalendarClock, Clock3, Stethoscope } from "lucide-react";
import { formatAbsoluteRangeLabel } from "@/lib/time/gridTime";
import { formatFullLocalDate } from "../components/SchedualeGrid/DNDGrid/utils/timeFormatters";

interface GridSelectionSummaryProps {
  doctorName: string;
  timeSlot: number;
  duration: number;
  date: Date;
}

export function GridSelectionSummary({
  doctorName,
  timeSlot,
  duration,
  date,
}: GridSelectionSummaryProps) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/90 to-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">
        Selected from schedule
      </p>
      <div className="mt-3 grid gap-2.5">
        <div className="flex items-center gap-2.5 text-sm text-neutral-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-blue-600 shadow-xs">
            <Stethoscope className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-neutral-500">Doctor</p>
            <p className="font-bold">{doctorName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-neutral-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-blue-600 shadow-xs">
            <Clock3 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-neutral-500">Time</p>
            <p className="font-bold">
              {formatAbsoluteRangeLabel(timeSlot, duration)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-neutral-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-blue-600 shadow-xs">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-neutral-500">Date</p>
            <p className="font-bold">{formatFullLocalDate(date)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
