import { memo } from "react";
import type { DragDataPayload } from "@/features/dashboardAssitant/types";
import { getStatusOverlayStyles } from "./utils/statusStyles";
import { formatDisplayTimeRange } from "./utils/timeFormatters";

interface DragOverlayCardProps {
  data: DragDataPayload;
  height: number;
}

export const DragOverlayCard = memo(function DragOverlayCard({
  data,
  height,
}: DragOverlayCardProps) {
  const { appointmentData } = data;
  if (!appointmentData) return null;

  const statusStyles = getStatusOverlayStyles(appointmentData.status, {
    startMinutes: appointmentData.start,
    endMinutes: appointmentData.end,
  });
  const patientName = appointmentData.title?.split(" - ")[0] || "Patient Name";

  return (
    <div
      style={{ height: height - 6 }}
      className={`w-[334px] border p-3 rounded-xl shadow-xl flex relative items-start select-none opacity-90 pointer-events-none z-50 ${statusStyles}`}
    >
      {/* Drag handle dots */}
      <div className="mr-2 mt-0.5 text-neutral-400 flex flex-col gap-0.5 cursor-grabbing">
        <span className="w-1 h-1 bg-current rounded-full" />
        <span className="w-1 h-1 bg-current rounded-full" />
        <span className="w-1 h-1 bg-current rounded-full" />
        <span className="w-1 h-1 bg-current rounded-full" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {(appointmentData.status === "urgent" ||
            appointmentData.complexity === "urgent") && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
              !
            </span>
          )}
          <h5 className="font-semibold text-neutral-800 text-xs truncate">
            {patientName}
          </h5>
        </div>
        <p className="text-[10px] font-medium opacity-75 mt-0.5">
          {formatDisplayTimeRange(appointmentData.start, appointmentData.end)}
        </p>
      </div>
    </div>
  );
});