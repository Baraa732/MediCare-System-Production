import { cn } from "@/lib/utils";
import { SLOT_HEIGHT, DOCTOR_COL_WIDTH } from "../../data/scheduleGrid";
import { useHandleSelection } from "../../hooks";
import { CellsLayer, ExistingBooked, PersistentSelectionArea } from ".";
import type { DoctorWithApts } from "./DNDGrid";

interface DoctorsColumnLayoutProps {
  doctors: DoctorWithApts[];
  overSlotInfo: { docId: string; slotIdx: number; top: number; height: number } | null;
}

export function DoctorsColumnLayout({
  doctors,
  overSlotInfo,
}: DoctorsColumnLayoutProps): React.ReactNode {
  const selection = useHandleSelection((state) => state.selection);

  return doctors.map((doctor) => {
    // جلب مواعيد الطبيب مباشرة من الـ State لضمان التزامن
    const columnAppointments = doctor.appointments || doctor.columnAppointments || [];
    const hasSelectionInColumn = selection?.docId === doctor.id;

    let selectionTop = 0;
    let selectionHeight = 0;
    if (hasSelectionInColumn && selection) {
      const minS = Math.min(selection.startSlot, selection.endSlot);
      const maxS = Math.max(selection.startSlot, selection.endSlot);
      selectionTop = minS * SLOT_HEIGHT;
      selectionHeight = (maxS - minS + 1) * SLOT_HEIGHT;
    }

    return (
      <div
        key={doctor.id}
        className={cn("h-full relative z-10", DOCTOR_COL_WIDTH)}
      >
        <CellsLayer
          columnAppointments={columnAppointments}
          idDoctor={doctor.id}
        />

        <PersistentSelectionArea
          hasSelectionInColumn={hasSelectionInColumn}
          selectionHeight={selectionHeight}
          selectionTop={selectionTop}
          doctorName={doctor.name}
        />

        {/* تمرير المواعيد والـ overSlotInfo لـ ExistingBooked */}
        <ExistingBooked 
          columnAppointments={columnAppointments} 
          docId={doctor.id} 
          overSlotInfo={overSlotInfo} 
        />
      </div>
    );
  });
}