import { Button } from "@/components/ui/button";
import { useEditeMode } from "../../hooks/useEditeMode";
import { Edit3, Plus, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { useWizardDrawer } from "../../hooks/useWizardDrawer";

export function ControlButton() {
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const onToggleEdit = useEditeMode((state) => state.onToggleEdit);

  const lastActionTime = useRef<number>(0);
  const COOLDOWN_MS = 2000; // 2 seconds

  const onOpenNewAppointment = useWizardDrawer(
    (state) => state.onOpenNewAppointment,
  );

  useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const now = Date.now();
    if (now - lastActionTime.current < COOLDOWN_MS) return;

    const key = e.key.toLowerCase();
    if (e.ctrlKey && e.shiftKey) {
      if (['E','e'].includes(key)) {
        e.preventDefault();
        lastActionTime.current = now;
        onToggleEdit();
      } else if (['U','u'].includes(key)) {
        e.preventDefault();
        lastActionTime.current = now;
        onOpenNewAppointment();
      }
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [onToggleEdit, onOpenNewAppointment]);
  return (
    <div className="p-4 space-y-2.5 border-b border-neutral-100">
      <Button
        className="btn-brand h-11 w-full justify-center rounded-xl px-4 text-xs font-bold"
        onClick={() => onOpenNewAppointment()}
      >
        <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
        <span>New appointment</span>
        <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white/90 font-mono">
          Ctrl + Shift + U
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
            : "bg-[#0B74FA1A] border-neutral-200 text-neutral-700 hover:bg-neutral-50",
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
            <span>Edit Mode</span>
          </>
        )}
        <kbd
          className={cn(
            "text-[10px] bg-white/20 px-1.5 py-0.5 rounded  font-mono",
            isEditMode ? "text-white" : "text-[#0B74FAB2]",
          )}
        >
          Ctrl + Shift + E
        </kbd>
      </Button>
    </div>
  );
}
