import { useEffect, useState } from "react";
import { CheckCircle2, RotateCcw, X, Info } from "lucide-react";

interface ToastProps {
  isOpen: boolean;
  patientName: string;
  newTimeLabel: string;
  onClose: () => void;
  onUndo: () => void;
  durationMs?: number;
  isTestingMessage?: boolean;
}

export function AppointmentUpdateToast({
  isOpen,
  patientName,
  newTimeLabel,
  onClose,
  onUndo,
  durationMs = 10000, // 10 Seconds action countdown default standard
  isTestingMessage = false,
}: ToastProps) {
  const [progress, setProgress] = useState(100);
  const [timeLeft, setTimeLeft] = useState(Math.ceil(durationMs / 1000));

  useEffect(() => {
    if (!isOpen) return;

    const startTime = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeLeft(Math.ceil(durationMs / 1000));
    setProgress(100);
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingProgress = Math.max(0, 100 - (elapsed / durationMs) * 100);
      const remainingSeconds = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      
      setProgress(remainingProgress);
      setTimeLeft(remainingSeconds);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        onClose();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen, durationMs, onClose]);

  if (!isOpen) return null;

  return (
    <div className="toast-enter fixed bottom-5 right-5 z-50 flex min-w-[360px] max-w-md flex-col overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/95 shadow-2xl backdrop-blur-md">
      {/* Visual Progress Micro-Bar */}
      <div 
        className={`h-1 transition-all duration-75 ${isTestingMessage ? "bg-blue-500" : "bg-emerald-500"}`}
        style={{ width: `${progress}%` }}
      />
      
      <div className="p-4 flex items-center justify-between gap-4">
        {isTestingMessage ? (
          // Option 1 Reschedule Temporary Message Block Layout
          <div className="flex gap-3 items-start flex-1 min-w-0">
            <div className="bg-blue-50 text-blue-500 p-2 rounded-lg shrink-0 mt-0.5">
              <Info className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-bold text-neutral-900 leading-tight">Hello</span>
              <p className="text-[11px] text-neutral-500 font-medium mt-1 leading-normal">
                This is only for testing and will be replaced later.
              </p>
            </div>
          </div>
        ) : (
          // Main Menu Structural Standard Countdown Layout
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="bg-emerald-50 text-emerald-500 p-2 rounded-lg shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex flex-col gap-0.5">
              <p className="text-[13px] font-bold text-neutral-900 truncate leading-tight">
                Action completed
              </p>
              {patientName && (
                <p className="text-[11px] font-semibold text-neutral-700 truncate">
                  Target: {patientName} ({newTimeLabel})
                </p>
              )}
              <p className="text-[11px] text-neutral-400 font-medium mt-1">
                Closing in: <span className="font-bold text-neutral-800 text-xs">{timeLeft}</span>
              </p>
            </div>
          </div>
        )}

        {/* Action Controller Tray */}
        <div className="flex items-center gap-2 shrink-0">
          {!isTestingMessage && (
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
          )}
          
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