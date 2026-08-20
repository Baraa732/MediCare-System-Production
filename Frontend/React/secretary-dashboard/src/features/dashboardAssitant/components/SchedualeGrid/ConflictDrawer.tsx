import {
  X,
  AlertTriangle,
  Calendar,
  Clock,
  Check,
  RotateCcw,
  User,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useGlobalConflictStore } from "../../hooks/useGlobalConflictStore";
import { cn } from "@/lib/utils";
import { START_TIME_MINUTES } from "../../data/scheduleGrid";
import type { DoctorType } from "../../types";

interface ConflictDrawerProps {
  onConfirm: () => void;
  onCancel: () => void;
  // تمرير مصفوفة الأطباء الحالية ودالة التحديث التابعة للمكون الأب (DNDGrid / useDragHandlers)
  doctors: DoctorType[];
  setDoctors: (updatedDoctors: DoctorType[]) => void;
}

export function ConflictDrawer({ onConfirm, onCancel, doctors, setDoctors }: ConflictDrawerProps) {
  const {
    isDrawerOpen,
    conflictPayload,
    clearConflict,
    executeAutoResolution,
  } = useGlobalConflictStore();
  const [notice, setNotice] = useState<string | null>(null);

  if (!isDrawerOpen || !conflictPayload) return null;

  const formatTime = (minutes: number) => {
    const total = START_TIME_MINUTES + minutes;
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    const displayH = h === 0 || h === 12 ? 12 : h % 12;
    return `${displayH}:${m === 0 ? "00" : m < 10 ? "0" + m : m} ${h >= 12 ? "PM" : "AM"}`;
  };
  // معالج الضغط على زر التخفيف وحل النزاع الذكي
  const handleAutoMitigate = () => {
    executeAutoResolution(
      doctors,
      setDoctors,
      (successMessage) => setNotice(successMessage),
      (manualMessage) =>
        setNotice(
          `${manualMessage} Choose Confirm Position or undo the move.`,
        ),
    );
  };

  return (
    <div className="overlay-backdrop fixed inset-0 z-50 flex justify-start">
      <div className="panel-slide-left m-6 flex h-[95.5%] w-[min(28.8vw,440px)] flex-col rounded-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-2xl backdrop-blur-md">
        {/* Header Layout - Matched with Dashboard Navbar Styling */}
        <div className="p-5 bg-white rounded-2xl border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-amber-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                Scheduling Conflict Detected
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                {conflictPayload.conflictingItems.length} affected appointment
                {conflictPayload.conflictingItems.length > 1 ? "s" : ""} sorted
                by priority
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors border border-transparent hover:border-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Notification Area - Styled exactly like the Top Dashboard Alert Rule */}
        <div className="px-5 py-3 bg-amber-50/60 border-b border-amber-200/80 text-amber-800 text-xs flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Review the conflicts below to clear overlapping schedules or
            force-confirm positions.
          </span>
        </div>
        {notice ? (
          <div className="mx-5 mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
            {notice}
          </div>
        ) : null}
        <button
          onClick={handleAutoMitigate}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-98 cursor-pointer border-none"
        >
          <Sparkles className="w-4 h-4 text-blue-200" />
          <span>⚡ Run Auto-Mitigation Engine</span>
        </button>
        <div className="stagger-list flex-1 space-y-4 overflow-y-auto p-5">
          {conflictPayload.conflictingItems.map((item) => {
            const isCritical = item.severity === "critical";
            const isWithinOneHour = item.start <= 60;

            return (
              <div
                key={item.appointmentId}
                className="surface-card surface-card-hover overflow-hidden"
              >
                {/* Top Badge Matrix - Reflecting Calendar Cell Top States */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      {item.patientName}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                        isCritical
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200",
                      )}
                    >
                      Priority {item.priorityScore}
                    </span>
                  </div>
                  <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
                    Elderly
                  </span>
                </div>

                {/* Core Medical Details - Aligned with Quick Stats/Info Panel layout */}
                <div className="p-4 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-slate-600 font-medium">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.doctorName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {formatTime(item.start)} - {item.end - item.start} mins
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>05/05/2026</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold text-[10px] tracking-wider uppercase">
                        Type:
                      </span>
                      <span className="text-slate-700 truncate font-semibold">
                        {item.visitType}
                      </span>
                    </div>
                  </div>

                  {/* Conflict Impact Warning Container - Styled cleanly like Dashboard elements */}
                  <div
                    className={cn(
                      "p-3 rounded-lg text-xs flex items-start gap-2.5 font-medium border",
                      isCritical
                        ? "bg-red-50 text-red-800 border-red-100"
                        : "bg-amber-50 text-amber-800 border-amber-100",
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        "w-4 h-4 shrink-0 mt-0.5",
                        isCritical ? "text-red-600" : "text-amber-600",
                      )}
                    />
                    <div>
                      Overlaps with another booking by{" "}
                      <span className="font-bold underline">
                        {item.overlapMinutes} minutes
                      </span>
                      .
                    </div>
                  </div>

                  {/* Time Warning Rule (Starts within 1 hour) - Dashboard-inspired Banner component */}
                  {isWithinOneHour && (
                    <div className="p-3 rounded-lg bg-orange-50 text-orange-800 text-xs font-medium border border-orange-200 flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Workflow Warning:</strong> This appointment
                        starts within 1 hour. Immediate runtime modifications
                        affect live clinic workflows.
                      </div>
                    </div>
                  )}

                  {/* Individual Action Triggers */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {item.phone}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onCancel}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
                      >
                        Cancel Move
                      </button>
                      <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-xs">
                        Reschedule
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Global Footer Actions - Uniform with Dashboard Interaction Controls */}
        <div className="p-4 bg-white rounded-2xl border-t border-slate-200 grid grid-cols-2 gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
          <button
            onClick={onCancel}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" /> Undo Changes
          </button>
          <button
            onClick={() => {
              onConfirm();
              clearConflict();
            }}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98"
          >
            <Check className="w-4 h-4" /> Confirm Position
          </button>
        </div>
      </div>
    </div>
  );
}
