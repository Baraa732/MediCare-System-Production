import type { AppointmentType } from "@/features/dashboardAssitant/types";
import { cn } from "@/lib/utils";
import { GripVertical, Lock } from "lucide-react";
import { getAppointmentBorderClass } from "@/features/dashboardAssitant/utils/appointmentStatusStyles";

export function SideIconAppointementCard({
  isEditMode,
  apt,
  showGripHandle,
  showLockIcon,
  startMinutes,
  endMinutes,
  nowMinutes,
}: {
  isEditMode: boolean;
  apt: AppointmentType;
  showGripHandle: boolean;
  showLockIcon: boolean;
  startMinutes: number;
  endMinutes: number;
  nowMinutes: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0 border-r transition-all duration-350 ease-in-out bg-black/[0.02]",
        isEditMode
          ? "w-8 opacity-100"
          : "w-0 opacity-0 pointer-events-none border-r-transparent",
        getAppointmentBorderClass(apt.status, {
          startMinutes,
          endMinutes,
          nowMinutes,
        }),
      )}
    >
      {showGripHandle && (
        <GripVertical
          className={cn(
            "w-4 h-4 shrink-0 text-current opacity-70 group-hover:opacity-100 transition-all duration-350",
            isEditMode ? "scale-100 rotate-0" : "scale-75 -rotate-45",
          )}
        />
      )}
      {showLockIcon && (
        <Lock
          className={cn(
            "w-4 h-4 shrink-0 text-neutral-400 opacity-60 transition-all duration-350",
            isEditMode ? "scale-100" : "scale-75",
          )}
        />
      )}
    </div>
  );
}
