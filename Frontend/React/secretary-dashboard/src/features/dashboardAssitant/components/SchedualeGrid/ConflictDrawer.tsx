import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  AlertTriangle,
  CalendarClock,
  ArrowDownRight,
  ArrowUpRight,
  UserRoundCog,
  Ban,
  Check,
  ShieldAlert,
} from "lucide-react";
import { useGlobalConflictStore } from "../../hooks/useGlobalConflictStore";
import { START_TIME_MINUTES } from "../../data/scheduleGrid";
import { cn } from "@/lib/utils";
import type {
  ResolutionPlan,
  ResolutionStep,
} from "./DNDGrid/utils/conflictResolve";

interface ConflictDrawerProps {
  onClose: () => void;
  onApplyResolution: (planId: string) => void;
}

function formatTime(minutes: number) {
  const total = START_TIME_MINUTES + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const displayH = h === 0 || h === 12 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function StepIcon({ kind }: { kind?: string }) {
  if (kind === "shift_earlier") return <ArrowUpRight className="h-3.5 w-3.5" />;
  if (kind === "shift_later" || kind === "shift")
    return <ArrowDownRight className="h-3.5 w-3.5" />;
  if (kind === "transfer") return <UserRoundCog className="h-3.5 w-3.5" />;
  if (kind === "cancel") return <Ban className="h-3.5 w-3.5" />;
  return <AlertTriangle className="h-3.5 w-3.5" />;
}

function strategyAccent(strategy: ResolutionPlan["strategy"]) {
  switch (strategy) {
    case "push_earlier":
      return "border-[#0066ff]/35 bg-blue-50";
    case "push_later":
      return "border-[#0066ff]/25 bg-blue-50/70";
    case "transfer":
      return "border-emerald-200 bg-emerald-50/60";
    case "hybrid":
      return "border-[#0066ff]/20 bg-sky-50/80";
    case "cancel_place":
      return "border-rose-200 bg-rose-50/50";
    default:
      return "border-neutral-200 bg-white";
  }
}

function StepRow({ step }: { step: ResolutionStep }) {
  const timeChanged =
    step.fromStart !== step.toStart || step.fromEnd !== step.toEnd;
  const docChanged = step.fromDocId !== step.toDocId;

  return (
    <li className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-3">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
          (step.kind === "shift_earlier" || step.kind === "shift_later") &&
            "border-[#0066ff]/20 bg-blue-50 text-[#0066ff]",
          step.kind === "transfer" &&
            "border-emerald-200 bg-emerald-50 text-emerald-700",
          step.kind === "cancel" && "border-rose-200 bg-rose-50 text-rose-700",
        )}
      >
        <StepIcon kind={step.kind} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900">
          {step.patientName}
        </p>
        {timeChanged && (
          <p className="mt-0.5 text-[11px] tabular-nums text-neutral-600">
            <span className="text-neutral-400">
              {formatTime(step.fromStart)}–{formatTime(step.fromEnd)}
            </span>
            <span className="mx-1.5 text-[#0066ff]">→</span>
            <span className="font-semibold text-neutral-800">
              {formatTime(step.toStart)}–{formatTime(step.toEnd)}
            </span>
          </p>
        )}
        {docChanged && (
          <p className="mt-0.5 text-[11px] text-neutral-600">
            <span className="text-neutral-400">
              {step.fromDoctorName || "Current doctor"}
            </span>
            <span className="mx-1.5 text-[#0066ff]">→</span>
            <span className="font-semibold">
              {step.toDoctorName || "Other doctor"}
            </span>
          </p>
        )}
        {!timeChanged && !docChanged && (
          <p className="mt-0.5 text-[11px] text-neutral-500">{step.detail}</p>
        )}
      </div>
    </li>
  );
}

export function ConflictDrawer({
  onClose,
  onApplyResolution,
}: ConflictDrawerProps) {
  const { isDrawerOpen, conflictPayload, clearConflict } =
    useGlobalConflictStore();
  const [selectedPlanId, setSelectedPlanId] = useState<string>("abort");

  const plans = useMemo(() => {
    if (!conflictPayload) return [] as ResolutionPlan[];
    if (conflictPayload.plans?.length) return conflictPayload.plans;
    return conflictPayload.resolution?.plans ?? [];
  }, [conflictPayload]);

  const recommendedId =
    conflictPayload?.recommendedPlanId ??
    conflictPayload?.resolution?.recommendedPlanId ??
    null;

  useEffect(() => {
    if (!isDrawerOpen || !conflictPayload) return;
    const initial =
      recommendedId && plans.some((p) => p.id === recommendedId)
        ? recommendedId
        : plans[0]?.id ?? "abort";
    setSelectedPlanId(initial);
  }, [isDrawerOpen, conflictPayload, recommendedId, plans]);

  if (!isDrawerOpen || !conflictPayload) return null;

  const isAssign = conflictPayload.attemptedAction === "assign";
  const pending = conflictPayload.pendingDrag;
  const lockMessages =
    conflictPayload.lockMessages ??
    conflictPayload.resolution?.lockMessages ??
    [];

  const handleClose = () => {
    clearConflict();
    onClose();
  };

  const handleConfirm = () => {
    if (selectedPlanId === "abort") {
      handleClose();
      return;
    }
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return;

    if (plan.strategy === "cancel_place") {
      const count = plan.proposedCancelIds?.length ?? 0;
      const ok = window.confirm(
        `Cancel ${count} overlapping appointment${count === 1 ? "" : "s"} and place yours?\n\nPatients are notified when you save Edit Mode changes.`,
      );
      if (!ok) return;
    }

    onApplyResolution(plan.id);
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

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
        className="conflict-modal-panel surface-card relative z-10 flex max-h-[min(92vh,760px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white"
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
                  {isAssign ? "Slot unavailable" : "Choose a resolution plan"}
                </h2>
                <p className="mt-1 max-w-[40ch] text-xs leading-relaxed text-neutral-500">
                  Ranked options below. Nothing moves until you confirm.
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

          {lockMessages.length > 0 && (
            <div className="relative mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Safety locks active</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-800/90">
                  {lockMessages.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
                <p className="mt-1 text-amber-700/80">
                  Auto shift/transfer plans are hidden. You can cancel overlaps
                  or pick another slot.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
              Resolution plans
            </div>
            <div
              className="space-y-2"
              role="radiogroup"
              aria-label="Conflict resolution plan"
            >
              {plans.map((plan) => {
                const selected = selectedPlanId === plan.id;
                const isRecommended = plan.id === recommendedId;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "overflow-hidden rounded-xl border transition",
                      selected
                        ? "border-[#0066ff]/45 shadow-sm"
                        : "border-neutral-200 hover:border-[#0066ff]/25",
                      strategyAccent(plan.strategy),
                    )}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className="flex w-full gap-3 p-3 text-left"
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
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-neutral-900">
                            {plan.title}
                          </span>
                          {isRecommended &&
                            plan.strategy !== "cancel_place" && (
                              <span className="rounded-md bg-[#0066ff] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                Recommended
                              </span>
                            )}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-neutral-500">
                          {plan.summary}
                        </span>
                      </span>
                    </button>

                    {selected && plan.steps.length > 0 && (
                      <div className="border-t border-neutral-200/80 bg-white/80 px-3 py-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                          Plan preview
                        </p>
                        <ol className="space-y-2">
                          {plan.steps.map((step, idx) => (
                            <StepRow
                              key={`${step.appointmentId}-${step.kind}-${idx}`}
                              step={step}
                            />
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                role="radio"
                aria-checked={selectedPlanId === "abort"}
                onClick={() => setSelectedPlanId("abort")}
                className={cn(
                  "flex w-full gap-3 rounded-xl border p-3 text-left transition",
                  selectedPlanId === "abort"
                    ? "border-[#0066ff]/40 bg-blue-50 shadow-sm"
                    : "border-neutral-200 bg-white hover:border-[#0066ff]/25 hover:bg-blue-50/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    selectedPlanId === "abort"
                      ? "border-[#0066ff] bg-[#0066ff] text-white"
                      : "border-neutral-300 bg-white text-transparent",
                  )}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-900">
                    Don&apos;t move — keep looking
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-neutral-500">
                    Cancel this drop. The appointment stays in its original
                    slot.
                  </span>
                </span>
              </button>
            </div>
          </section>

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
            {selectedPlanId === "abort"
              ? "Close without moving"
              : selectedPlan?.strategy === "cancel_place"
                ? "Confirm cancellation"
                : "Confirm plan"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
