import { Plus } from "lucide-react";
import { useWizardDrawer } from "../../hooks/useWizardDrawer";
import { SLOT_HEIGHT, START_TIME_MINUTES } from "../../data/scheduleGrid";
import { useHandleDatePicker } from "../../hooks";

interface PersistentSelectionAreaProps {
  hasSelectionInColumn: boolean;
  selectionHeight: number;
  selectionTop: number;
  doctorId: string;     // 👈 نمرر معرّف طبيب العمود هنا
}

export function PersistentSelectionArea({
  hasSelectionInColumn,
  selectionHeight,
  selectionTop,
  doctorId,
}: PersistentSelectionAreaProps): React.ReactNode {
    const selectedDate = useHandleDatePicker((state) => state.date);
  const onOpenNewAppointment = useWizardDrawer((state) => state.onOpenNewAppointment);

  const handleTriggerWizardWithSelection = () => {
    // const SLOT_HEIGHT = 40; // الارتفاع الرسومي للسلوت الواحد في مشروعك
    
    // حساب الدقائق النسبية بناءً على موضع السحب العلوي
    const relativeStartMinutes = Math.round(selectionTop / SLOT_HEIGHT) * 15;
    const durationMinutes = Math.round(selectionHeight / SLOT_HEIGHT) * 15;
    
    // تحويلها إلى وقت مطلق من منتصف الليل متوافق تماماً مع محرك الفلترة والـ Form
    const absoluteStartTime = START_TIME_MINUTES + relativeStartMinutes;

    onOpenNewAppointment({
      doctorId: doctorId,
      timeSlot: absoluteStartTime,
      duration: Math.max(15, durationMinutes),
      date:  selectedDate,
    });
  };

  return (
    hasSelectionInColumn &&
    selectionHeight > 0 && (
      <div
        style={{
          top: selectionTop + 3,
          height: selectionHeight - 6,
        }}
        className="absolute left-2 right-2 rounded-xl border border-dashed border-[#0066ff]/60 bg-blue-100/50 shadow-xs flex items-center justify-center transition-all duration-75 z-20"
      >
        <button
          onClick={handleTriggerWizardWithSelection}
          className="h-8 px-4 bg-[#0066ff] hover:bg-[#0052cc] active:scale-95 transition-all rounded-lg shadow-sm flex items-center gap-1.5 text-white text-[11px] font-bold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-3" />
        </button>
      </div>
    ) 
  );
}