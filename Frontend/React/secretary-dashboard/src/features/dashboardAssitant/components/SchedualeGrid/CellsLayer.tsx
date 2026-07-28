import { TOTAL_SLOTS, ROW_MINUTES, SLOT_HEIGHT } from "../../data/scheduleGrid";
import { useEditeMode, useHandleSelection } from "../../hooks";
import type { AppointmentType } from "../../types";
import { useDroppable } from "@dnd-kit/core";

// 1. مكوّن منفصل لكل خلية زمنية لمنع خطأ الـ Rules of Hooks
interface GridCellProps {
  slotIdx: number;
  idDoctor: string;
  isOccupied: boolean;
  isEditMode: boolean;
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
  onMouseDown,
  onMouseEnter,
}: GridCellProps) {
  const slotMinutesStart = slotIdx * ROW_MINUTES;

  // جلب دالة فتح موعد جديد من الـ Zustand Store
  // const onOpenNewAppointment = useWizardDrawer(
  //   (state) => state.onOpenNewAppointment,
  // );

  const { setNodeRef, isOver, active } = useDroppable({
    id: `slot-${idDoctor}-${slotIdx}`,
    data: {
      type: "slot",
      idDoctor,
      slotIdx,
      timeStart: slotMinutesStart,
    },
    disabled: !isEditMode || isOccupied,
  });

  if (isOccupied) return <div style={{ height: SLOT_HEIGHT }} />;

  const isValidIncomingType = active?.data.current?.type === "appointment";
  // ||    active?.data.current?.type === "pending_request";

  return (
    <div
      ref={setNodeRef}
      style={{ height: SLOT_HEIGHT }}
      onMouseDown={(e) => onMouseDown(e, { idDoctor, isEditMode, slotIdx })}
      onMouseEnter={() => onMouseEnter({ idDoctor, slotIdx })}
      // onClick={() =>
      //   onOpenNewAppointment({
      //     doctorId: idDoctor,
      //     timeSlot: slotIdx * ROW_MINUTES,
      //     treatmentId : "t1"
      //   })
      // }
      className="w-full h-full relative group transition-colors duration-150 cursor-crosshair border-b border-transparent"
    >
      {isOver && isEditMode && isValidIncomingType && (
        <div className="absolute inset-x-2 inset-y-1 rounded-xl border-2 border-dashed border-orange-400 bg-orange-50/70 flex items-center justify-center animate-pulse z-30 transition-all">
          <span className="text-[10px] font-bold text-orange-700 bg-white/90 px-2 py-0.5 rounded-md border border-orange-100 shadow-sm">
            Drop Here
          </span>
        </div>
      )}

      {!isOver && (
        <div className="absolute inset-x-3 inset-y-1 rounded-xl border border-dashed border-[#0066ff]/30 bg-blue-50/40 hidden group-hover:flex transition-all" />
      )}
    </div>
  );
}

// المكوّن الرئيسي الذي يستدعيه الـ Layout
export function CellsLayer({
  columnAppointments,
  idDoctor,
}: {
  columnAppointments: AppointmentType[];
  idDoctor: string;
}) {
  // const isSelecting = useHandleSelection((state) => state.isSelecting);
  const onMouseDown = useHandleSelection((state) => state.onMouseDown);
  const onMouseEnter = useHandleSelection((state) => state.onMouseEnter);
  const isEditMode = useEditeMode((state) => state.isEditMode);

  return (
    <>
      {Array.from({ length: TOTAL_SLOTS }).map((_, slotIdx) => {
        const slotMinutesStart = slotIdx * ROW_MINUTES;
        const isOccupied = columnAppointments.some(
          (a) => slotMinutesStart >= a.start && slotMinutesStart < a.end,
        );

        return (
          <GridCell
            key={slotIdx}
            slotIdx={slotIdx}
            idDoctor={idDoctor}
            isOccupied={isOccupied}
            isEditMode={isEditMode}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
          />
        );
      })}
    </>
  );
}
