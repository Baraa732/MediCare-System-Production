import type { AppointmentDisplayStatus } from "@/features/dashboardAssitant/utils/appointmentStatusStyles";
import { cn } from "@/lib/utils";

export function ContentAppointementCard({
  showLockIcon,
  showGripHandle,
  appointement,
  formatTimeLabel,
  startH,
  startM,
  endH,
  endM,
  showUrgentIndicator = false,
  displayStatus,
  note,
}: {
  showLockIcon: boolean;
  showGripHandle: boolean;
  appointement: { patientName: string; visitType: string };
  formatTimeLabel: (h: number, m: number) => string;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  showUrgentIndicator?: boolean;
  displayStatus?: AppointmentDisplayStatus;
  note?: string | null;
}) {
  const shortNote = note?.trim() || "";

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-between p-3 text-xs transition-all duration-350">
      <div className="flex min-w-0 items-start gap-1.5">
        <div
          className={cn(
            "animate-bounce overflow-hidden transition-all duration-200",
            showUrgentIndicator && !showLockIcon && !showGripHandle
              ? "mr-1 w-1.5 opacity-100"
              : "mr-0 w-0 opacity-0",
          )}
        >
          <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
        </div>

        <div className="min-w-0 flex-1">
          <h5 className="truncate text-[13px] font-bold leading-none text-neutral-900 transition-colors">
            {appointement.patientName}
          </h5>
          <p className="mt-1 truncate text-[11px] font-normal leading-tight text-neutral-500">
            {appointement.visitType}
          </p>
          <p className="mt-1.5 truncate text-[10px] font-semibold leading-none opacity-75">
            {formatTimeLabel(startH, startM)} - {formatTimeLabel(endH, endM)}
          </p>
          {shortNote ? (
            <p
              title={shortNote}
              className="mt-1.5 line-clamp-2 text-[10px] font-medium leading-snug text-neutral-600"
            >
              {shortNote}
            </p>
          ) : null}
          {displayStatus === "pending_request" ? (
            <p className="mt-1 text-[9px] font-bold tracking-wide text-red-600 uppercase">
              Pending request
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
