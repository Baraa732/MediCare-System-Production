import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  AlertTriangle,
  CalendarClock,
  ArrowDownRight,
  UserRoundCog,
  Ban,
  Check,
} from "lucide-react";
import { useGlobalConflictStore } from "../../hooks/useGlobalConflictStore";
import { START_TIME_MINUTES } from "../../data/scheduleGrid";
import { cn } from "@/lib/utils";

interface ConflictDrawerProps {
  onClose: () => void;
  onApplyResolution: (choice: "apply" | "cancel") => void;
}

type DecisionChoice = "apply" | "cancel" | "abort";

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

function planLabel(action?: string | null) {
  switch (action) {
    case "Shifted Down":
    case "Shifted Down Chain":
      return "Push overlapping visits later";
    case "Transferred Doctor":
      return "Transfer overlapping visits";
    default:
      return "Apply suggested plan";
  }
}

export function ConflictDrawer({
  onClose,
  onApplyResolution,
}: ConflictDrawerProps) {
  const { isDrawerOpen, conflictPayload, clearConflict } =
    useGlobalConflictStore();
  const [choice, setChoice] = useState<DecisionChoice>("abort");

  const resolution = conflictPayload?.resolution;
  const pending = conflictPayload?.pendingDrag;
  const canApplyPlan =
    !!pending &&
    resolution?.status === "Resolved" &&
    (resolution.updatedExistingAppointments.length ?? 0) > 0;
  const canCancel =
    !!pending &&
    ((resolution?.proposedCancelIds?.length ?? 0) > 0 ||
      (conflictPayload?.conflictingItems.length ?? 0) > 0);

  useEffect(() => {
    if (!isDrawerOpen || !conflictPayload) return;
    if (canApplyPlan) setChoice("apply");
    else if (canCancel) setChoice("cancel");
    else setChoice("abort");
  }, [isDrawerOpen, conflictPayload, canApplyPlan, canCancel]);

  const options = useMemo(() => {
    const list: Array<{
      id: DecisionChoice;
      title: string;
      description: string;
      enabled: boolean;
    }> = [];

    if (canApplyPlan) {
      list.push({
        id: "apply",
        title: planLabel(resolution?.action),
        description:
          resolution?.message ||
          "Place your drop and adjust overlapping visits as proposed.",
        enabled: true,
      });
    }

    if (canCancel) {
      const count =
        resolution?.proposedCancelIds?.length ||
        conflictPayload?.conflictingItems.length ||
        0;
      list.push({
        id: "cancel",
        title: `Cancel ${count} overlapping visit${count === 1 ? "" : "s"}`,
        description:
          "Place yours and mark conflicts cancelled. Patients are notified when you Save.",
        enabled: true,
      });
    }

    list.push({
      id: "abort",
      title: "Don't move — keep looking",
      description:
        "Cancel this drop. The appointment stays in its original slot.",
      enabled: true,
    });

    return list;
  }, [canApplyPlan, canCancel, resolution, conflictPayload]);

  if (!isDrawerOpen || !conflictPayload) return null;

  const isAssign = conflictPayload.attemptedAction === "assign";

  const handleClose = () => {
    clearConflict();
    onClose();
  };

  const handleConfirm = () => {
    if (choice === "abort") {
      handleClose();
      return;
    }
    if (choice === "cancel") {
      const count =
        resolution?.proposedCancelIds?.length ||
        conflictPayload.conflictingItems.length;
      const ok = window.confirm(
        `Cancel ${count} overlapping appointment${count === 1 ? "" : "s"} and place yours?\n\nPatients are notified when you save Edit Mode changes.`,
      );
      if (!ok) return;
      onApplyResolution("cancel");
      return;
    }
    onApplyResolution("apply");
  };

  return createPortal(
    <div className="conflict-modal-root fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close conflict dialog"
        className="conflict-modal-backdrop absolute inset-0 bg-neutral-900/40"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        className="conflict-modal-panel surface-card relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white"
      >
        <div className="relative border-b border-neutral-100 bg-blue-50/50 px-5 pb-4 pt-5">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[#0066ff]/10 blur-2xl" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-[#0066ff]/20 bg-white text-[#0066ff] shadow-sm">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0066ff]">
                  Schedule conflict
                </p>
                <h2
                  id="conflict-title"
                  className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900"
                >
                  {isAssign ? "Slot unavailable" : "Choose how to resolve"}
                </h2>
                <p className="mt-1 max-w-[36ch] text-xs leading-relaxed text-neutral-500">
                  The system suggests options — nothing moves until you confirm.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-transparent p-1.5 text-neutral-400 transition hover:border-neutral-200 hover:bg-white hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {pending && (
            <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-[#0066ff]/20 bg-white px-3 py-2.5 text-xs shadow-sm">
              <CalendarClock className="h-4 w-4 shrink-0 text-[#0066ff]" />
              <div className="min-w-0">
                <p className="font-semibold text-neutral-800">
                  Your drop · {formatTime(pending.start)}–
                  {formatTime(pending.end)}
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                  {pending.patient?.name ||
                    pending.title?.split(" - ")[0] ||
                    "Dragged appointment"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
              Your decision
            </div>
            <div className="space-y-2" role="radiogroup" aria-label="Conflict decision">
              {options.map((opt) => {
                const selected = choice === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!opt.enabled}
                    onClick={() => setChoice(opt.id)}
                    className={cn(
                      "conflict-step-card flex w-full gap-3 rounded-xl border p-3 text-left transition",
                      selected
                        ? "border-[#0066ff]/40 bg-blue-50 shadow-sm"
                        : "border-neutral-200 bg-white hover:border-[#0066ff]/25 hover:bg-blue-50/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        selected
                          ? "border-[#0066ff] bg-[#0066ff] text-white"
                          : "border-neutral-300 bg-white text-transparent",
                      )}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-neutral-900">
                        {opt.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-neutral-500">
                        {opt.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {resolution?.steps &&
            resolution.steps.length > 0 &&
            choice === "apply" && (
              <section>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                  Plan preview
                </div>
                <ol className="space-y-2">
                  {resolution.steps.map((step, idx) => (
                    <li
                      key={`${step.appointmentId}-${step.kind}-${idx}`}
                      className="flex gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-3"
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                          step.kind === "shift" &&
                            "border-[#0066ff]/20 bg-blue-50 text-[#0066ff]",
                          step.kind === "transfer" &&
                            "border-emerald-200 bg-emerald-50 text-emerald-700",
                          step.kind === "cancel" &&
                            "border-rose-200 bg-rose-50 text-rose-700",
                        )}
                      >
                        <StepIcon kind={step.kind} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900">
                          {step.patientName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-neutral-500">
                          {step.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

          <section>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
              Overlapping visits
            </div>
            <div className="space-y-2">
              {conflictPayload.conflictingItems.map((item) => (
                <div
                  key={item.appointmentId}
                  className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50/90 px-3.5 py-2.5">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {item.patientName}
                    </p>
                    {item.overlapMinutes > 0 && (
                      <span className="shrink-0 rounded-md border border-rose-100 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        −{item.overlapMinutes}m
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-3.5 py-2.5 text-[11px] text-neutral-600">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                        Doctor
                      </p>
                      <p className="mt-0.5 font-medium">{item.doctorName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
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

        <div className="flex gap-2 border-t border-neutral-100 bg-white px-5 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="flex h-10 flex-1 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-brand flex h-10 flex-[1.4] items-center justify-center rounded-xl border-0 px-4 text-xs font-bold text-white shadow-sm"
          >
            {choice === "abort" ? "Close without moving" : "Confirm decision"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
