import { useRedLine } from "../../hooks/useRedLine";
import { useHandleSelection } from "../../hooks/useHandleSelection";
import { useEditeMode } from "../../hooks/useEditeMode"; // استدعاء هوك وضع التعديل
import { DNDGrid, InformationPanel } from ".";
import { AlertTriangle } from "lucide-react"; // أيقونة التحذير
import React from "react";

export function ScheduleGrid() {
  // جلب خط الوقت
  const computeLinePosition = useRedLine((state) => state.computeLinePosition);

  // إدارة الاختيارات للجدول
  const handleKeyDown = useHandleSelection((state) => state.handleKeyDown);

  // جلب حالة وضع التعديل ودالة الإغلاق
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const onToggleEdit = useEditeMode((state) => state.onToggleEdit);

  React.useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  React.useEffect(() => {
    computeLinePosition();
    const interval = setInterval(computeLinePosition, 500);
    return () => clearInterval(interval);
  }, [computeLinePosition]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative bg-white border border-neutral-200 shadow-xs select-none transition-all duration-350 ease-in-out">
      
      {/* 1. شريط التحذير العلوي بكامل العرض عند تفعيل الـ Edit Mode */}
      <div
  className={`w-full bg-amber-50 text-amber-800 text-xs font-bold z-40 shrink-0 overflow-hidden transition-all duration-350 ease-in-out ${
    isEditMode 
      ? "max-h-16 border-b border-amber-200 opacity-100 py-3 px-5" 
      : "max-h-0 border-b-transparent opacity-0 py-0 px-5 pointer-events-none"
  }`}
>
  {/* حاوية داخلية إضافية مخصصة لضمان ثبات العناصر ومنع اهتزاز النص أثناء الانزلاق الحركي */}
  <div 
    className={`flex items-center justify-between w-full transition-all duration-300 ${
      isEditMode ? "translate-y-0 opacity-100 scale-100" : "-translate-y-2 opacity-0 scale-95"
    }`}
  >
    <div className="flex items-center gap-2.5">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
      <span>
        Edit mode is activated. Any move may lead to changes in the schedules
      </span>
    </div>
    
    <button
      onClick={onToggleEdit}
      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-extrabold transition-all duration-200 cursor-pointer shadow-xs active:scale-95 hover:shadow-sm"
    >
      Exit edit mode
    </button>
  </div>
</div>

      <DNDGrid />
      <InformationPanel />
    </div>
  );
}