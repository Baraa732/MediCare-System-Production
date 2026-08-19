import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createAppointment } from "@/lib/api/appointments";
import { lookupPatientByPhone } from "@/lib/api/users";
import { normalizeCaughtError } from "@/lib/api/errors";
import { scheduledAtFromGridMinutes } from "@/lib/api/mappers";
import { ROW_MINUTES } from "../data/scheduleGrid";
import { useAuthStore } from "@/stores/authStore";
import { useAppointmentDialog } from "../hooks/useAppointmentDialog";
import { useScheduleContext } from "../context/ScheduleContext";
import type { PatientLookup } from "@/lib/api/users";

function formatSlotRange(startSlot: number, endSlot: number) {
  const startMins = startSlot * ROW_MINUTES;
  const endMins = (endSlot + 1) * ROW_MINUTES;
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const displayH = h % 12 || 12;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${displayH}:${m.toString().padStart(2, "0")} ${ampm}`;
  };
  return `${fmt(startMins)} – ${fmt(endMins)}`;
}

export function AddAppointmentDialog() {
  const isOpen = useAppointmentDialog((s) => s.isOpen);
  const prefill = useAppointmentDialog((s) => s.prefill);
  const closeDialog = useAppointmentDialog((s) => s.closeDialog);

  const accessToken = useAuthStore((s) => s.accessToken);
  const { doctors, selectedDate, refetch, clinicId } = useScheduleContext();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patient, setPatient] = useState<PatientLookup | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPhoneNumber("");
    setPatientName("");
    setPatient(null);
    setReason("");
    setLookupError(null);
    setSubmitError(null);
    setDoctorId(prefill?.doctorId ?? doctors[0]?.id ?? "");
  }, [isOpen, prefill, doctors]);

  const timeLabel = useMemo(() => {
    if (prefill?.startSlot == null || prefill?.endSlot == null) return null;
    return formatSlotRange(prefill.startSlot, prefill.endSlot);
  }, [prefill]);

  const durationMinutes = useMemo(() => {
    if (prefill?.startSlot == null || prefill?.endSlot == null) return 30;
    return (prefill.endSlot - prefill.startSlot + 1) * ROW_MINUTES;
  }, [prefill]);

  const handleLookup = async () => {
    if (!accessToken || !phoneNumber.trim()) {
      setLookupError("Enter the patient's phone number.");
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setPatient(null);

    try {
      const result = await lookupPatientByPhone(phoneNumber.trim(), accessToken);
      setPatient(result);
      setPatientName(
        result.fullName || `${result.firstName ?? ""} ${result.lastName ?? ""}`.trim(),
      );
    } catch (err) {
      setLookupError(
        normalizeCaughtError(
          err,
          "No registered patient was found. You can still continue with a manual booking.",
        ),
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async () => {
    if (!accessToken || !clinicId) {
      setSubmitError("Your session is invalid. Please sign in again.");
      return;
    }
    if (!patient) {
      if (!patientName.trim()) {
        setSubmitError("Enter the patient's name for manual booking.");
        return;
      }
    }
    if (!phoneNumber.trim()) {
      setSubmitError("Enter the patient's phone number.");
      return;
    }
    if (!doctorId) {
      setSubmitError("Select a doctor.");
      return;
    }
    if (prefill?.startSlot == null) {
      setSubmitError("Select a time slot on the schedule grid first.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const scheduledAt = scheduledAtFromGridMinutes(
        prefill.startSlot * ROW_MINUTES,
        selectedDate,
      );

      await createAppointment(
        {
          clinicId,
          doctorId,
          patientId: patient?.id,
          guestPatientName: patient ? undefined : patientName.trim(),
          guestPatientPhone: patient ? undefined : phoneNumber.trim(),
          scheduledAt,
          durationMinutes,
          reason: reason.trim() || undefined,
        },
        accessToken,
      );

      refetch();
      closeDialog();
    } catch (err) {
      setSubmitError(
        normalizeCaughtError(err, "Could not create the appointment. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New appointment</DialogTitle>
          <DialogDescription>
            {prefill?.doctorName && timeLabel
              ? `Book with ${prefill.doctorName} on ${timeLabel}`
              : "Select a time slot on the grid, then fill in patient details."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-600">
              Doctor
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              disabled={Boolean(prefill?.doctorId)}
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
            <label className="text-xs font-semibold text-neutral-600">
              Patient name
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Full patient name"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-600">
              Patient phone
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+963..."
                className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleLookup}
                disabled={isLookingUp}
              >
                {isLookingUp ? "..." : "Look up"}
              </Button>
            </div>
            {lookupError && (
              <p className="text-xs text-red-600">{lookupError}</p>
            )}
            {patient && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                Patient: {patient.fullName || `${patient.firstName} ${patient.lastName}`}
              </p>
            )}
            {!patient && phoneNumber.trim() && lookupError && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Booking will be saved as a manual guest appointment.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-600">
              Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Follow-up visit"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-[#0066ff] hover:bg-[#0052cc]"
          >
            {isSubmitting ? "Booking…" : "Book appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
