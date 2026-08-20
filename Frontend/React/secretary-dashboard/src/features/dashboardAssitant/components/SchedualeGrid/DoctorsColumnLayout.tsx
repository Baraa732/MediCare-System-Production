import { cn } from "@/lib/utils";
import { SLOT_HEIGHT, DOCTOR_COL_WIDTH } from "../../data/scheduleGrid";
import { useHandleSelection } from "../../hooks";
import type { DoctorType } from "../../types";
// 🚀 استهلاك متجر التضاربات لضبط عتامة الواجهة حياً
import { useGlobalConflictStore } from "../../hooks/useGlobalConflictStore";
import { ExistingBooked } from "./Appointement";
import { CellsLayer } from "./CellsLayer";
import { PersistentSelectionArea } from "./PersistentSelectionArea";

interface DoctorsColumnLayoutProps {
  doctors: DoctorType[];
  overSlotInfo: {
    docId: string;
    slotIdx: number;
    top: number;
    height: number;
  } | null;
}

export function DoctorsColumnLayout({
  doctors,
  overSlotInfo,
}: DoctorsColumnLayoutProps): React.ReactNode {
  const selection = useHandleSelection((state) => state.selection);
  const conflictPayload = useGlobalConflictStore(
    (state) => state.conflictPayload,
  );

  return doctors.map((doctor) => {
    const columnAppointments = doctor.appointments || [];
    const hasSelectionInColumn = selection?.docId === doctor.id;

    let selectionTop = 0;
    let selectionHeight = 0;
    if (hasSelectionInColumn && selection) {
      const minS = Math.min(selection.startSlot, selection.endSlot);
      const maxS = Math.max(selection.startSlot, selection.endSlot);
      selectionTop = minS * SLOT_HEIGHT;
      selectionHeight = (maxS - minS + 1) * SLOT_HEIGHT;
    }

    const isAnyConflictActive = !!conflictPayload;
    const isTargetDoctor = overSlotInfo?.docId === doctor.id;

    return (
      <div
        key={doctor.id}
        className={cn(
          "h-full relative z-10 transition-all duration-300",
          DOCTOR_COL_WIDTH,
        )}
        style={{
          opacity: isAnyConflictActive && !isTargetDoctor ? 0.35 : 1,
        }}
      >
        {/* طبقة الخلايا الزمنية الفارغة */}
        <CellsLayer
          columnAppointments={columnAppointments}
          idDoctor={doctor.id}
        />

        {/* مساحة التحديد المستمر للـ Dragging */}
        <PersistentSelectionArea
          hasSelectionInColumn={hasSelectionInColumn}
          selectionHeight={selectionHeight}
          selectionTop={selectionTop}
          doctorId={doctor.id} // 👈 نمرر id الطبيب الخاص بالعمود الحالي
        />

        {/* المواعيد المحجوزة الحالية وتأثير الإسقاط */}
        <ExistingBooked
          columnAppointments={columnAppointments}
          docId={doctor.id}
          overSlotInfo={overSlotInfo}
        />
      </div>
    );
  });
}
