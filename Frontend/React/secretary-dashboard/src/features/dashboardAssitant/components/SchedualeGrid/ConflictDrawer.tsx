import {
  X,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  Wand2,
  Ban,
} from "lucide-react";
import { useGlobalConflictStore } from "../../hooks/useGlobalConflictStore";
import { START_TIME_MINUTES } from "../../data/scheduleGrid";

interface ConflictDrawerProps {
  onClose: () => void;
  onApplyResolution: (withCancellations: boolean) => void;
}

function formatTime(minutes: number) {
  const total = START_TIME_MINUTES + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const displayH = h === 0 || h === 12 ? 12 : h % 12;
  return `${displayH}:${m === 0 ? "00" : m < 10 ? "0" + m : m} ${h >= 12 ? "PM" : "AM"}`;
}

export function ConflictDrawer({
  onClose,
  onApplyResolution,
}: ConflictDrawerProps) {
  const { isDrawerOpen, conflictPayload, clearConflict } =
    useGlobalConflictStore();

  if (!isDrawerOpen || !conflictPayload) return null;

  const isAssign = conflictPayload.attemptedAction === "assign";
  const resolution = conflictPayload.resolution;
  const canApplyUpdates =
    !!conflictPayload.pendingDrag &&
    !!resolution &&
    resolution.updatedExistingAppointments.length > 0;
  const canConfirmCancel =
    !!conflictPayload.pendingDrag &&
    !!resolution &&
    (resolution.proposedCancelIds?.length ?? 0) > 0;

  const handleClose = () => {
    clearConflict();
    onClose();
  };

  return (
    <div className="overlay-backdrop fixed inset-0 z-[80] flex justify-start">
      <div className="panel-slide-left m-6 flex h-[95.5%] w-[min(28.8vw,440px)] flex-col rounded-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between rounded-2xl border-b border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                Scheduling conflict
              </h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {isAssign
                  ? "Choose an empty slot for this pending request."
                  : "This drop overlaps existing appointments."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-transparent p-1.5 text-slate-400 transition-colors hover:border-slate-200 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50/80 px-5 py-3 text-xs font-medium text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            {resolution?.message ||
              "Pick another time or resolve the conflicting appointments."}
          </span>
        </div>

        <div className="stagger-list flex-1 space-y-3 overflow-y-auto p-5">
          {conflictPayload.conflictingItems.map((item) => (
            <div
              key={item.appointmentId}
              className="surface-card overflow-hidden"
            >
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-800">
                  {item.patientName}
                </span>
              </div>
              <div className="space-y-2 p-4 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>{item.doctorName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {formatTime(item.start)} · {item.end - item.start} min
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Overlaps by {item.overlapMinutes} min</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-2xl border-t border-slate-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
          {canApplyUpdates && (
            <button
              type="button"
              onClick={() => onApplyResolution(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700 transition-all hover:bg-blue-100 active:scale-98"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Apply auto-fix
            </button>
          )}
          {canConfirmCancel && (
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm(
                  `Cancel ${resolution?.proposedCancelIds?.length ?? 0} conflicting appointment(s) and place yours? Patients will be notified when you save.`,
                );
                if (!ok) return;
                onApplyResolution(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 transition-all hover:bg-red-100 active:scale-98"
            >
              <Ban className="h-3.5 w-3.5" />
              Cancel conflicting & place mine
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-98"
          >
            Keep looking
          </button>
        </div>
      </div>
    </div>
  );
}
