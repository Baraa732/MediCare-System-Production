import { Button } from "@/components/ui/button";
import { useEditeMode } from "../../hooks/useEditeMode";
import { Edit3, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { useWizardDrawer } from "../../hooks/useWizardDrawer";
import { useScheduleDnd } from "../../context/ScheduleDndContext";
import { useScheduleContext } from "../../context/ScheduleContext";
import { isClinicDateBeforeToday } from "../../utils/editModeDrag";

export function ControlButton() {
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const onToggleEdit = useEditeMode((state) => state.onToggleEdit);
  const { requestExitEditMode, dirtyCount } = useScheduleDnd();
  const { selectedDate } = useScheduleContext();
  const isPastDay = isClinicDateBeforeToday(selectedDate);

  const lastActionTime = useRef<number>(0);
  const COOLDOWN_MS = 2000;

  const onOpenNewAppointment = useWizardDrawer(
    (state) => state.onOpenNewAppointment,
  );

  // Past days are show-only — force exit edit mode.
  useEffect(() => {
    if (isPastDay && isEditMode) {
      requestExitEditMode();
    }
  }, [isPastDay, isEditMode, requestExitEditMode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastActionTime.current < COOLDOWN_MS) return;

      const key = e.key.toLowerCase();
      if (e.ctrlKey && e.shiftKey) {
        if (key === "e") {
          e.preventDefault();
          if (isPastDay) return;
          lastActionTime.current = now;
          if (isEditMode) requestExitEditMode();
          else onToggleEdit();
        } else if (key === "u") {
          e.preventDefault();
          if (isPastDay) return;
          lastActionTime.current = now;
          onOpenNewAppointment();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    isEditMode,
    isPastDay,
    onToggleEdit,
    onOpenNewAppointment,
    requestExitEditMode,
  ]);

  return (
    <div className="space-y-2.5 border-b border-neutral-100 p-4">
      {isPastDay ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-[11px] font-semibold text-amber-800">
          Show-only day — past dates cannot be edited or booked.
        </div>
      ) : null}

      <Button
        disabled={isPastDay}
        className="btn-brand h-11 w-full justify-center rounded-xl px-4 text-xs font-bold disabled:pointer-events-none disabled:opacity-40"
        onClick={() => onOpenNewAppointment()}
        title={isPastDay ? "Cannot book on a past day" : undefined}
      >
        <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
        <span>New appointment</span>
        <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] text-white/90">
          Ctrl + Shift + U
        </kbd>
      </Button>

      <Button
        disabled={isPastDay && !isEditMode}
        variant={isEditMode ? "default" : "outline"}
        onClick={() => {
          if (isPastDay && !isEditMode) return;
          if (isEditMode) requestExitEditMode();
          else onToggleEdit();
        }}
        className={cn(
          "h-11 w-full cursor-pointer justify-center rounded-xl border px-4 text-xs font-bold transition-all duration-200",
          isEditMode
            ? "border-red-600 bg-red-500 text-white shadow-md shadow-red-100 hover:border-red-700 hover:bg-red-600"
            : "border-neutral-200 bg-[#0B74FA1A] text-neutral-700 hover:bg-neutral-50",
          isPastDay && !isEditMode && "pointer-events-none opacity-40",
        )}
        title={isPastDay ? "Edit mode unavailable on past days" : undefined}
      >
        {isEditMode ? (
          <>
            <X className="mr-1 h-4 w-4 stroke-[2.5]" />
            <span>Exit edit mode</span>
            {dirtyCount > 0 ? (
              <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
                {dirtyCount}
              </span>
            ) : null}
          </>
        ) : (
          <>
            <Edit3 className="mr-1 h-4 w-4" />
            <span>Edit Mode</span>
          </>
        )}
        <kbd
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[10px]",
            isEditMode ? "bg-white/20 text-white" : "bg-white/20 text-[#0B74FAB2]",
          )}
        >
          Ctrl + Shift + E
        </kbd>
      </Button>
    </div>
  );
}
