import type { AppointmentType } from "@/features/dashboardAssitant/types";
import { cn } from "@/lib/utils";
import { GripVertical ,Lock} from "lucide-react";

export function SideIconAppointementCard({
  isEditMode,
  apt,
  showGripHandle,
  showLockIcon,
}: {
  isEditMode: boolean;
  apt: AppointmentType;
  showGripHandle: boolean;
  showLockIcon: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0 border-r transition-all duration-350 ease-in-out bg-black/[0.02]",
        isEditMode
          ? "w-8 opacity-100"
          : "w-0 opacity-0 pointer-events-none border-r-transparent",

        apt.status === "confirmed" && "border-blue-200/50",
        apt.status === "urgent" && "border-red-200/50",
        apt.status === "in_progress" && "border-purple-200/50",
        apt.status === "late" && "border-amber-200/50",
        apt.status === "unavailable" && "border-neutral-200/50",
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
