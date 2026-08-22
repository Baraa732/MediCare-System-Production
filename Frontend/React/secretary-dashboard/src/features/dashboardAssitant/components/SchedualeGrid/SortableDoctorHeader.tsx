import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react"; 
import type { DoctorType } from "../../types";

export function SortableDoctorHeader({
  id,
  doctor,
  disabled,
}: {
  id: string;
  doctor: DoctorType;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  
  // تعديل 1: استخدام CSS.Translate لمنع التشوه وقفزات الإحداثيات الأفقية
  // وتمرير الـ transition فقط عندما لا نكون في حالة سحب نشطة لمنع الـ Lag
  const style = { 
    transform: CSS.Translate.toString(transform), 
    transition: isDragging ? undefined : transition 
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // تعديل 2: استبدال transition-all بـ transition-colors لمنع Tailwind من تحريك الـ transform برمجياً
        "bg-white p-3.5 flex items-center justify-between transition-colors duration-200 w-full h-16 box-border",
        isDragging && "shadow-xl bg-neutral-50/90 z-50 relative opacity-90 border border-neutral-200 rounded-xl",
        !disabled && "cursor-grab active:cursor-grabbing hover:bg-neutral-50/80",
      )}
    >
      <div
        className="flex items-center gap-3 min-w-0 w-full justify-between"
        {...(!disabled ? { ...attributes, ...listeners } : {})}
      >
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={doctor.avatar}
            alt={doctor.name}
            className="w-9 h-9 rounded-xl border border-neutral-200/80 shrink-0 object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/defaults/default-doctor.jpg";
            }}
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-neutral-900 truncate leading-none">
              {doctor.name}
            </h4>
            <p className="text-[11px] font-semibold text-neutral-400 mt-1.5 leading-none">
              {doctor.appointments.length} patients
            </p>
          </div>
        </div>

        {/* مقبض السحب الأنيق المعتمد على الـ Edit Mode */}
        {!disabled && (
          <GripVertical className="w-4 h-4 text-neutral-400 shrink-0 ml-1.5 opacity-70 hover:opacity-100 transition-opacity" />
        )}
      </div>
    </div>
  );
}