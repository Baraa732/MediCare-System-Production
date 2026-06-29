import { Button } from "@/components/ui/button";
import { useEditeMode } from "../../hooks/useEditeMode";
import { useAppointmentDialog } from "../../hooks/useAppointmentDialog";
import { useHandleSelection } from "../../hooks/useHandleSelection";
import { Edit3, Plus, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function ControlButton() {
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const onToggleEdit = useEditeMode((state) => state.onToggleEdit);
  const openDialog = useAppointmentDialog((s) => s.openDialog);
  const selection = useHandleSelection((s) => s.selection);

  const handleNewAppointment = () => {
    if (selection) {
      openDialog({
        doctorId: selection.docId,
        startSlot: Math.min(selection.startSlot, selection.endSlot),
        endSlot: Math.max(selection.startSlot, selection.endSlot),
      });
      return;
    }
    openDialog();
  };

  return (
    <div className="p-4 space-y-2.5 border-b border-neutral-100">
      <Button
        className="w-full h-11 bg-[#0066ff] hover:bg-[#0052cc] text-white font-bold rounded-xl shadow-sm justify-center px-4 text-xs "
        onClick={handleNewAppointment}
      >
        <Plus className="w-4 h-4" />
        <span>New appointment</span>
        <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white/90 font-mono">
          Ctrl + N
        </kbd>
      </Button>

      {/* تحديث نمط ونصوص الزر وفقاً للمواصفات الجديدة */}
      <Button
        variant={isEditMode ? "default" : "outline"}
        onClick={onToggleEdit}
        className={cn(
          "w-full h-11 font-bold rounded-xl justify-center px-4 text-xs border transition-all duration-200 cursor-pointer",
          isEditMode
            ? "bg-red-500 border-red-600 text-white hover:bg-red-600 hover:border-red-700 shadow-md shadow-red-100"
            : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
        )}
      >
        {isEditMode ? (
          <>
            <LogOut className="w-4 h-4 mr-1 stroke-[2.5]" />
            <span>Exit edit mode</span>
          </>
        ) : (
          <>
            <Edit3 className="w-4 h-4 mr-1" />
            <span>Activate Edit Mode</span>
          </>
        )}
      </Button>
    </div>
  );
}