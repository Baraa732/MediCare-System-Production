import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  Phone,
  Stethoscope,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppointmentDrawer } from "../hooks/useAppointmentDrawer";
import { useScheduleContext } from "../context/ScheduleContext";
import { useAuthStore } from "@/stores/authStore";
import {
  cancelAppointment,
  getAppointment,
  updateAppointment,
  updateAppointmentStatus,
} from "@/lib/api/appointments";
import { normalizeCaughtError } from "@/lib/api/errors";
import type { EnrichedAppointment } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { getApiStatusBadgeMeta } from "../utils/appointmentStatusStyles";
import {
  absoluteMinutesFromDate,
  gridMinutesFromAbsolute,
  gridMinutesFromIso,
} from "@/lib/time/gridTime";
import { formatClinicDateTime } from "@/lib/time/clinicTime";

/** Short note shown on the schedule card — keep it readable on the grid. */
export const GRID_NOTE_MAX_LENGTH = 60;

function formatDateTime(iso: string) {
  return formatClinicDateTime(iso);
}

export function AppointmentDetailDrawer() {
  const appointmentId = useAppointmentDrawer((s) => s.appointmentId);
  const close = useAppointmentDrawer((s) => s.close);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { refetch } = useScheduleContext();

  const [appointment, setAppointment] = useState<EnrichedAppointment | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const open = Boolean(appointmentId);

  useEffect(() => {
    if (!appointmentId || !accessToken) {
      setAppointment(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getAppointment(appointmentId, accessToken)
      .then((res) => {
        if (cancelled) return;
        setAppointment(res.appointment);
        setNotes((res.appointment.notes ?? "").slice(0, GRID_NOTE_MAX_LENGTH));
        setCancelReason("");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            normalizeCaughtError(err, "Could not load appointment details."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appointmentId, accessToken]);

  const patientName = useMemo(
    () =>
      appointment?.patientName ||
      appointment?.guestPatientName ||
      "Patient",
    [appointment],
  );

  const patientPhone = useMemo(
    () =>
      appointment?.patientPhone ||
      appointment?.guestPatientPhone ||
      null,
    [appointment],
  );

  const initials = useMemo(
    () =>
      patientName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("") || "P",
    [patientName],
  );

  const notesDirty =
    (notes.trim() || "") !== (appointment?.notes?.trim() || "");

  const handleSaveNote = async () => {
    if (!accessToken || !appointment) return;
    setIsSaving(true);
    setError(null);
    try {
      const trimmed = notes.trim().slice(0, GRID_NOTE_MAX_LENGTH);
      const res = await updateAppointment(
        appointment.id,
        { notes: trimmed || "" },
        accessToken,
      );
      setAppointment(res.appointment);
      setNotes((res.appointment.notes ?? "").slice(0, GRID_NOTE_MAX_LENGTH));
      refetch();
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not save note."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (
    status: "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED",
  ) => {
    if (!accessToken || !appointment) return;
    setIsCancelling(status === "CANCELLED");
    setError(null);
    try {
      if (status === "CANCELLED") {
        await cancelAppointment(
          appointment.id,
          accessToken,
          cancelReason.trim() || undefined,
        );
      } else {
        await updateAppointmentStatus(
          appointment.id,
          { status },
          accessToken,
        );
      }
      refetch();
      close();
    } catch (err) {
      setError(
        normalizeCaughtError(err, "Could not update appointment status."),
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const isTerminal =
    appointment?.status === "CANCELLED" || appointment?.status === "COMPLETED";
  const status = useMemo(() => {
    if (!appointment) return null;
    const startMinutes = gridMinutesFromIso(appointment.scheduledAt);
    const duration = appointment.durationMinutes ?? 30;
    return getApiStatusBadgeMeta(appointment.status, {
      startMinutes,
      endMinutes: startMinutes + duration,
      nowMinutes: gridMinutesFromAbsolute(absoluteMinutesFromDate(new Date())),
      scheduledDate: new Date(appointment.scheduledAt),
    });
  }, [appointment]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[75] flex justify-end">
      <button
        type="button"
        aria-label="Close appointment details"
        className="overlay-backdrop absolute inset-0"
        onClick={close}
      />

      <aside className="panel-slide-right relative z-10 m-4 flex h-[calc(100%-2rem)] w-[min(420px,100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-2xl">
        <div className="shrink-0 border-b border-neutral-100 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 px-5 py-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 text-sm font-bold text-white shadow-sm">
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold tracking-tight text-neutral-900">
                  {patientName}
                </h2>
                <p className="truncate text-xs text-neutral-500">
                  {appointment
                    ? `${appointment.doctorName ?? "Doctor"} · ${formatDateTime(appointment.scheduledAt)}`
                    : "Loading appointment…"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-xl p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {status ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1",
                status.className,
              )}
            >
              {status.label}
            </span>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading details…
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {appointment && !loading ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <InfoTile
                  icon={Clock3}
                  label="Duration"
                  value={`${appointment.durationMinutes} min`}
                />
                <InfoTile
                  icon={CalendarClock}
                  label="Scheduled"
                  value={formatDateTime(appointment.scheduledAt)}
                />
                <InfoTile
                  icon={Stethoscope}
                  label="Doctor"
                  value={appointment.doctorName ?? "—"}
                  className="col-span-2"
                />
                {appointment.reason ? (
                  <InfoTile
                    icon={UserRound}
                    label="Reason"
                    value={appointment.reason}
                    className="col-span-2"
                  />
                ) : null}
                {patientPhone ? (
                  <InfoTile
                    icon={Phone}
                    label="Phone"
                    value={patientPhone}
                    className="col-span-2"
                  />
                ) : null}
              </div>

              {!isTerminal ? (
                <section className="space-y-3 rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                      Grid note
                    </p>
                    <span className="text-[10px] font-semibold text-neutral-400">
                      {notes.length}/{GRID_NOTE_MAX_LENGTH}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Short note shown on the schedule card. Other details are
                    read-only.
                  </p>
                  <textarea
                    value={notes}
                    onChange={(e) =>
                      setNotes(e.target.value.slice(0, GRID_NOTE_MAX_LENGTH))
                    }
                    rows={2}
                    maxLength={GRID_NOTE_MAX_LENGTH}
                    className="textarea-modern resize-none text-sm"
                    placeholder="e.g. Bring X-rays, allergic to penicillin"
                  />
                </section>
              ) : appointment.notes ? (
                <section className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4">
                  <p className="mb-1 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                    Grid note
                  </p>
                  <p className="text-sm text-neutral-700">{appointment.notes}</p>
                </section>
              ) : null}

              {appointment.status === "REQUESTED" ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="btn-brand h-10 flex-1 rounded-xl border-0"
                    onClick={() => void handleStatusChange("CONFIRMED")}
                    disabled={isCancelling}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => void handleStatusChange("CANCELLED")}
                    disabled={isCancelling}
                  >
                    Decline
                  </Button>
                </div>
              ) : null}

              {!isTerminal && appointment.status !== "REQUESTED" ? (
                <section className="space-y-3 rounded-2xl border border-neutral-100 p-4">
                  <p className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                    Quick actions
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl text-xs font-semibold"
                      onClick={() => void handleStatusChange("COMPLETED")}
                      disabled={isCancelling}
                    >
                      Mark completed
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl text-xs font-semibold"
                      onClick={() => void handleStatusChange("NO_SHOW")}
                      disabled={isCancelling}
                    >
                      No-show
                    </Button>
                  </div>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Cancellation reason (optional)"
                    className="input-modern text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => void handleStatusChange("CANCELLED")}
                    disabled={isCancelling}
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    {isCancelling ? "Cancelling…" : "Cancel appointment"}
                  </Button>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-neutral-100 bg-white px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 rounded-xl"
            onClick={close}
          >
            Close
          </Button>
          {!isTerminal && appointment ? (
            <Button
              type="button"
              onClick={() => void handleSaveNote()}
              disabled={isSaving || !notesDirty}
              className="btn-brand h-10 flex-[1.4] rounded-xl border-0 disabled:opacity-40"
            >
              {isSaving ? "Saving…" : "Save note"}
            </Button>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-100 bg-white px-3 py-2.5 shadow-sm",
        className,
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-neutral-400 uppercase">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-sm font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
