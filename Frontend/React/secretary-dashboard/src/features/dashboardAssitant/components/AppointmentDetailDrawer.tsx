import { useEffect, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AppointmentDetailDrawer() {
  const appointmentId = useAppointmentDrawer((s) => s.appointmentId);
  const close = useAppointmentDrawer((s) => s.close);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { doctors, refetch } = useScheduleContext();

  const [appointment, setAppointment] = useState<EnrichedAppointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

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
        setReason(res.appointment.reason ?? "");
        setNotes(res.appointment.notes ?? "");
        setDoctorId(res.appointment.doctorId);
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

  const handleSave = async () => {
    if (!accessToken || !appointment) return;
    setIsSaving(true);
    setError(null);
    try {
      const body: {
        reason?: string;
        notes?: string;
        doctorId?: string;
      } = {
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (doctorId && doctorId !== appointment.doctorId) {
        body.doctorId = doctorId;
      }
      const res = await updateAppointment(appointment.id, body, accessToken);
      setAppointment(res.appointment);
      refetch();
    } catch (err) {
      setError(normalizeCaughtError(err, "Could not save changes."));
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

  return (
    <Drawer
      open={Boolean(appointmentId)}
      onOpenChange={(open) => !open && close()}
      direction="right"
    >
      <DrawerContent className="data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-md rounded-l-2xl border-l border-neutral-100">
        <DrawerHeader className="border-b border-neutral-100 bg-gradient-to-br from-blue-50/70 to-white">
          <DrawerTitle className="text-base font-bold">Appointment details</DrawerTitle>
          <DrawerDescription>
            {appointment
              ? `${appointment.patientName || appointment.guestPatientName || "Patient"} · ${appointment.doctorName ?? "Doctor"} · ${formatDateTime(appointment.scheduledAt)}`
              : "Loading appointment…"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-4">
          {loading && (
            <p className="text-sm text-neutral-500">Loading…</p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {appointment && !loading && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
                  <p className="text-xs font-semibold text-neutral-400 uppercase">Status</p>
                  <p className="font-medium">{appointment.status}</p>
                </div>
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
                  <p className="text-xs font-semibold text-neutral-400 uppercase">Duration</p>
                  <p className="font-medium">{appointment.durationMinutes} min</p>
                </div>
                <div className="col-span-2 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
                  <p className="text-xs font-semibold text-neutral-400 uppercase">Patient</p>
                  <p className="font-medium">
                    {appointment.patientName || appointment.guestPatientName || "Guest patient"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {appointment.patientPhone || appointment.guestPatientPhone || "No phone on file"}
                  </p>
                </div>
              </div>

              {!isTerminal && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-600">Doctor</label>
                    <select
                      value={doctorId}
                      onChange={(e) => setDoctorId(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    >
                      {doctors.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-600">Reason</label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-600">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
                    />
                  </div>
                </>
              )}

              {appointment.status === "REQUESTED" && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1 bg-[#0066ff] hover:bg-[#0052cc]"
                    onClick={() => void handleStatusChange("CONFIRMED")}
                    disabled={isCancelling}
                  >
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => void handleStatusChange("CANCELLED")}
                    disabled={isCancelling}
                  >
                    Decline
                  </Button>
                </div>
              )}

              {!isTerminal && appointment.status !== "REQUESTED" && (
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  <p className="text-xs font-semibold text-neutral-500 uppercase">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleStatusChange("COMPLETED")}
                      disabled={isCancelling}
                    >
                      Mark completed
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
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
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => void handleStatusChange("CANCELLED")}
                    disabled={isCancelling}
                  >
                    {isCancelling ? "Cancelling…" : "Cancel appointment"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <DrawerFooter>
          {!isTerminal && appointment && (
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="bg-[#0066ff] hover:bg-[#0052cc]"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={close}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
