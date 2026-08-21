import { TOTAL_SLOTS, ROW_MINUTES, SLOT_HEIGHT } from "../../data/scheduleGrid";
import { useEditeMode, useHandleSelection } from "../../hooks";
import type { AppointmentType } from "../../types";
import { useDroppable } from "@dnd-kit/core";
import { useScheduleContext } from "../../context/ScheduleContext";
import { isGridSlotInPast } from "../../utils/editModeDrag";
import { isGridSlotOutsideClinicHours } from "../../utils/clinicHours";
import { cn } from "@/lib/utils";

interface GridCellProps {
  slotIdx: number;
  idDoctor: string;
  isOccupied: boolean;
  isEditMode: boolean;
  isUnavailable: boolean;
  unavailableReason?: string;
  onMouseDown: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    data: { idDoctor: string; isEditMode: boolean; slotIdx: number },
  ) => void;
  onMouseEnter: (data: { idDoctor: string; slotIdx: number }) => void;
}

function GridCell({
  slotIdx,
  idDoctor,
  isOccupied,
  isEditMode,
  isUnavailable,
  unavailableReason,
  onMouseDown,
  onMouseEnter,
}: GridCellProps) {
  const slotMinutesStart = slotIdx * ROW_MINUTES;
  const dropDisabled = !isEditMode || isUnavailable;

  const { setNodeRef, isOver, active } = useDroppable({
    id: `slot-${idDoctor}-${slotIdx}`,
    data: {
      type: "slot",
      idDoctor,
      slotIdx,
      timeStart: slotMinutesStart,
      isUnavailable,
    },
    disabled: dropDisabled,
  });

  if (isOccupied && !isEditMode) {
    return <div style={{ height: SLOT_HEIGHT }} />;
  }

  const isValidIncomingType =
    !isUnavailable && active?.data.current?.type === "appointment";

  return (
    <div
      ref={setNodeRef}
      style={{ height: SLOT_HEIGHT }}
      onMouseDown={(e) => {
        if (isUnavailable) return;
        onMouseDown(e, { idDoctor, isEditMode, slotIdx });
      }}
      onMouseEnter={() => {
        if (isUnavailable) return;
        onMouseEnter({ idDoctor, slotIdx });
      }}
      className={cn(
        "relative w-full h-full border-b border-transparent transition-colors duration-150",
        isUnavailable
          ? "cursor-not-allowed bg-neutral-50/70"
          : "cursor-crosshair group",
      )}
      title={isUnavailable ? unavailableReason : undefined}
    >
      {isOver && isEditMode && isValidIncomingType && (
        <div className="absolute inset-x-2 inset-y-1 z-30 flex animate-pulse items-center justify-center rounded-xl border-2 border-dashed border-orange-400 bg-orange-50/70 transition-all">
          <span className="rounded-md border border-orange-100 bg-white/90 px-2 py-0.5 text-[10px] font-bold text-orange-700 shadow-sm">
            Drop Here
          </span>
        </div>
      )}

      {!isOver && !isUnavailable && (
        <div className="absolute inset-x-3 inset-y-1 hidden rounded-xl border border-dashed border-[#0066ff]/30 bg-blue-50/40 transition-all group-hover:flex" />
      )}

      {isUnavailable && !isOccupied ? (
        <div className="pointer-events-none absolute inset-x-2 inset-y-1 rounded-lg bg-neutral-100/50" />
      ) : null}
    </div>
  );
}

export function CellsLayer({
  columnAppointments,
  idDoctor,
}: {
  columnAppointments: AppointmentType[];
  idDoctor: string;
}) {
  const onMouseDown = useHandleSelection((state) => state.onMouseDown);
  const onMouseEnter = useHandleSelection((state) => state.onMouseEnter);
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const { selectedDate, clinicHours } = useScheduleContext();

  return (
    <>
      {Array.from({ length: TOTAL_SLOTS }).map((_, slotIdx) => {
        const slotMinutesStart = slotIdx * ROW_MINUTES;
        const isOccupied = columnAppointments.some(
          (a) => slotMinutesStart >= a.start && slotMinutesStart < a.end,
        );
        const isPast = isGridSlotInPast(slotMinutesStart, selectedDate);
        const isOutsideHours = isGridSlotOutsideClinicHours(
          slotMinutesStart,
          selectedDate,
          clinicHours,
          ROW_MINUTES,
        );
        const isUnavailable = isPast || isOutsideHours;
        const unavailableReason = isPast
          ? "Past time — not available"
          : isOutsideHours
            ? "Outside clinic open hours"
            : undefined;

        return (
          <GridCell
            key={slotIdx}
            slotIdx={slotIdx}
            idDoctor={idDoctor}
            isOccupied={isOccupied}
            isEditMode={isEditMode}
            isUnavailable={isUnavailable}
            unavailableReason={unavailableReason}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
          />
        );
      })}
    </>
  );
}
