import { createPortal } from "react-dom";
import {
  X,
  AlertTriangle,
  CalendarClock,
  ArrowDownRight,
  UserRoundCog,
  Ban,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useGlobalConflictStore } from "../../hooks/useGlobalConflictStore";
import { START_TIME_MINUTES } from "../../data/scheduleGrid";
import { cn } from "@/lib/utils";

interface ConflictDrawerProps {
  onClose: () => void;
  onApplyResolution: (withCancellations: boolean) => void;
}

function formatTime(minutes: number) {
  const total = START_TIME_MINUTES + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const displayH = h === 0 || h === 12 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function StepIcon({ kind }: { kind?: string }) {
  if (kind === "shift") return <ArrowDownRight className="h-3.5 w-3.5" />;
  if (kind === "transfer") return <UserRoundCog className="h-3.5 w-3.5" />;
  if (kind === "cancel") return <Ban className="h-3.5 w-3.5" />;
  return <AlertTriangle className="h-3.5 w-3.5" />;
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
  const canApplyAuto =
    !!conflictPayload.pendingDrag &&
    resolution?.status === "Resolved" &&
    (resolution.updatedExistingAppointments.length ?? 0) > 0;
  const canConfirmCancel =
    !!conflictPayload.pendingDrag &&
    (resolution?.proposedCancelIds?.length ?? 0) > 0;
  const pending = conflictPayload.pendingDrag;

  const handleClose = () => {
    clearConflict();
    onClose();
  };

  return createPortal(
    <div className="conflict-modal-root fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close conflict dialog"
        className="conflict-modal-backdrop absolute inset-0 bg-slate-950/45"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        className="conflict-modal-panel relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
      >
        <div className="relative overflow-hidden border-b border-slate-200/80 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_45%,#eff6ff_100%)] px-5 pb-4 pt-5">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-amber-300/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-sky-300/20 blur-2xl" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700/80">
                  Conflict engine
                </p>
                <h2
                  id="conflict-title"
                  className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900"
                >
                  {isAssign ? "Slot unavailable" : "Drop blocked by overlap"}
                </h2>
                <p className="mt-1 max-w-[34ch] text-xs leading-relaxed text-slate-600">
                  {resolution?.message ||
                    (isAssign
                      ? "Choose an empty slot for this pending request."
                      : "This drop overlaps existing appointments on the target doctor.")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-transparent p-1.5 text-slate-400 transition hover:border-slate-200 hover:bg-white hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {pending && (
            <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-sky-200/80 bg-white/80 px-3 py-2.5 text-xs shadow-sm backdrop-blur-sm">
              <CalendarClock className="h-4 w-4 shrink-0 text-sky-600" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">
                  Your drop · {formatTime(pending.start)}–{formatTime(pending.end)}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {pending.patient?.name ||
                    pending.title?.split(" - ")[0] ||
                    "Dragged appointment"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {resolution?.steps && resolution.steps.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <Sparkles className="h-3 w-3" />
                Resolution plan
              </div>
              <ol className="space-y-2">
                {resolution.steps.map((step, idx) => (
                  <li
                    key={`${step.appointmentId}-${step.kind}-${idx}`}
                    className="conflict-step-card flex gap-3 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        step.kind === "shift" &&
                          "border-sky-200 bg-sky-50 text-sky-700",
                        step.kind === "transfer" &&
                          "border-emerald-200 bg-emerald-50 text-emerald-700",
                        step.kind === "cancel" &&
                          "border-rose-200 bg-rose-50 text-rose-700",
                      )}
                    >
                      <StepIcon kind={step.kind} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {step.patientName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Overlapping visits
            </div>
            <div className="space-y-2">
              {conflictPayload.conflictingItems.map((item, idx) => (
                <div
                  key={item.appointmentId}
                  className="conflict-step-card overflow-hidden rounded-xl border border-slate-200 bg-white"
                  style={{ animationDelay: `${80 + idx * 50}ms` }}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-3.5 py-2.5">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.patientName}
                    </p>
                    {item.overlapMinutes > 0 && (
                      <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-100">
                        −{item.overlapMinutes}m
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-3.5 py-2.5 text-[11px] text-slate-600">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Doctor
                      </p>
                      <p className="mt-0.5 font-medium">{item.doctorName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Time
                      </p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {formatTime(item.start)} · {item.end - item.start} min
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          {canApplyAuto && (
            <button
              type="button"
              onClick={() => onApplyResolution(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.99]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Apply safe auto-fix
            </button>
          )}
          {canConfirmCancel && (
            <button
              type="button"
              onClick={() => {
                const count = resolution?.proposedCancelIds?.length ?? 0;
                const ok = window.confirm(
                  `Cancel ${count} locked appointment${count === 1 ? "" : "s"} and place yours?\n\nPatients are notified when you save Edit Mode changes.`,
                );
                if (!ok) return;
                onApplyResolution(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 active:scale-[0.99]"
            >
              <Ban className="h-3.5 w-3.5" />
              Cancel conflicting & place mine
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
          >
            Keep looking for another slot
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
