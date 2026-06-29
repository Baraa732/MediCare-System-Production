import { useEffect, useState } from "react";
import { CheckCircle2, RotateCcw, X } from "lucide-react";

interface ToastProps {
  isOpen: boolean;
  patientName: string;
  newTimeLabel: string;
  onClose: () => void;
  onUndo: () => void;
  durationMs?: number;
}

export function AppointmentUpdateToast({
  isOpen,
  patientName,
  newTimeLabel,
  onClose,
  onUndo,
  durationMs = 5000,
}: ToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isOpen) return;

    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        onClose();
      }
    }, 30);

    return () => clearInterval(interval);
  }, [isOpen, durationMs, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 min-w-[360px] max-w-md bg-white border border-neutral-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col">
      
      {/* 1. شريط الوقت (Timer) متمركز في الأعلى تماماً */}
      <div className="w-full h-[3px] bg-neutral-50 relative shrink-0">
        <div 
          className="h-full bg-emerald-500 transition-all ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 2. صف المحتوى والأزرار أسفل شريط الوقت */}
      <div className="p-4 flex items-center justify-between gap-4">
        
        {/* التفاصيل: اسم المريض والوقت الجديد */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="bg-emerald-50 text-emerald-500 p-2 rounded-lg shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-neutral-900 truncate leading-tight">
              {patientName}
            </p>
            <p className="text-[11px] text-neutral-500 font-medium mt-1.5 leading-none">
              {newTimeLabel}
            </p>
          </div>
        </div>

        {/* أزرار التحكم: زر الـ Undo وزر الإغلاق الجانبي */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              onUndo();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 rounded-lg transition-colors active:scale-[0.98]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Undo
          </button>
          
          <button 
            onClick={onClose} 
            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}