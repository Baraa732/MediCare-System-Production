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
}) {
  return (
    <div className="flex-1 p-3 flex flex-col justify-between text-xs min-w-0 transition-all duration-350">
      <div className="flex items-start gap-1.5 min-w-0">
        {/* URGENT additional indicator — matches information panel legend */}
        <div
          className={cn(
            "transition-all duration-200 overflow-hidden animate-bounce",
            showUrgentIndicator && !showLockIcon && !showGripHandle
              ? "w-1.5 opacity-100 mr-1"
              : "w-0 opacity-0 mr-0",
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 block mt-1.5 shrink-0" />
        </div>

        <div className="min-w-0 flex-1">
          <h5 className="font-bold truncate leading-none text-neutral-900 transition-colors text-[13px]">
            {appointement.patientName}
          </h5>
          <p className="text-[11px] font-normal text-neutral-500 mt-1 truncate leading-tight">
            {appointement.visitType}
          </p>
          <p className="text-[10px] font-semibold opacity-75 mt-1.5 leading-none truncate">
            {formatTimeLabel(startH, startM)} - {formatTimeLabel(endH, endM)}
          </p>
          {displayStatus === "pending_request" ? (
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-red-600">
              Pending request
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
