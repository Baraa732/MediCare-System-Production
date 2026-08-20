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
import { formatSlotLabel, listAvailableSlots } from "@/lib/api/schedule";
import {
  formatAbsoluteRangeLabel,
  gridMinutesFromSlot,
  scheduledAtFromGridMinutes,
  slotRangeDurationMinutes,
} from "@/lib/time/gridTime";
import { START_TIME_MINUTES } from "../data/scheduleGrid";
import { useAuthStore } from "@/stores/authStore";
import { useAppointmentDialog } from "../hooks/useAppointmentDialog";
import { useScheduleContext } from "../context/ScheduleContext";
import type { PatientLookup } from "@/lib/api/users";
import { CalendarClock, Clock3, Stethoscope } from "lucide-react";

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
  const [selectedSlotIso, setSelectedSlotIso] = useState("");
  const [manualDuration, setManualDuration] = useState(30);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPhoneNumber("");
    setPatientName("");
    setPatient(null);
    setReason("");
    setLookupError(null);
    setSubmitError(null);
    setSelectedSlotIso("");
    setManualDuration(30);
    setDoctorId(prefill?.doctorId ?? doctors[0]?.id ?? "");
  }, [isOpen, prefill, doctors]);

  const selectedDoctorName = useMemo(
    () =>
      prefill?.doctorName ??
      doctors.find((doc) => doc.id === doctorId)?.name ??
      "Doctor",
    [prefill?.doctorName, doctors, doctorId],
  );

  const timeLabel = useMemo(() => {
    if (prefill?.startSlot == null || prefill?.endSlot == null) return null;
    const startGrid = gridMinutesFromSlot(
      Math.min(prefill.startSlot, prefill.endSlot),
    );
    const duration = slotRangeDurationMinutes(
      prefill.startSlot,
      prefill.endSlot,
    );
    return formatAbsoluteRangeLabel(
      START_TIME_MINUTES + startGrid,
      duration,
    );
  }, [prefill]);

  const durationMinutes = useMemo(() => {
    if (prefill?.startSlot == null || prefill?.endSlot == null) {
      return manualDuration;
    }
    return slotRangeDurationMinutes(prefill.startSlot, prefill.endSlot);
  }, [prefill, manualDuration]);

  useEffect(() => {
    if (!isOpen || prefill?.startSlot != null) return;
    if (!accessToken || !clinicId || !doctorId) {
      setSlots([]);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    setSelectedSlotIso("");

    void listAvailableSlots(
      {
        clinicId,
        doctorId,
        date: selectedDate,
        durationMinutes,
      },
      accessToken,
    )
      .then((res) => {
        if (cancelled) return;
        setSlots(res.slots ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setSlots([]);
        setSlotsError(
          normalizeCaughtError(err, "Could not load available time slots."),
        );
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    prefill?.startSlot,
    accessToken,
    clinicId,
    doctorId,
    selectedDate,
    durationMinutes,
  ]);

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
    if (!patient && !patientName.trim()) {
      setSubmitError("Enter the patient's name for manual booking.");
      return;
    }
    if (!phoneNumber.trim()) {
      setSubmitError("Enter the patient's phone number.");
      return;
    }
    if (!doctorId) {
      setSubmitError("Select a doctor.");
      return;
    }

    let scheduledAt = selectedSlotIso;
    if (prefill?.startSlot != null) {
      scheduledAt = scheduledAtFromGridMinutes(
        gridMinutesFromSlot(
          Math.min(prefill.startSlot, prefill.endSlot ?? prefill.startSlot),
        ),
        selectedDate,
      );
    }
    if (!scheduledAt) {
      setSubmitError("Select an available time slot.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
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
      <DialogContent className="sm:max-w-lg rounded-2xl border border-neutral-100 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-neutral-100 bg-gradient-to-br from-blue-50/70 to-white">
          <DialogTitle className="text-lg font-bold text-neutral-900">
            New appointment
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            {prefill?.doctorName && timeLabel
              ? "Review the selected slot, then add patient details."
              : "Fill in patient details and pick an available slot."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {prefill?.startSlot != null && timeLabel ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 grid gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <Stethoscope className="h-4 w-4 text-blue-600" />
                {selectedDoctorName}
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <Clock3 className="h-4 w-4 text-blue-600" />
                {timeLabel}
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                {selectedDate.toDateString()} · {durationMinutes} min
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-600">
              Doctor
            </label>
            <select
              value={doctorId}
              onChange={(e) => {
                setDoctorId(e.target.value);
                setSelectedSlotIso("");
              }}
              disabled={Boolean(prefill?.doctorId)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
          </div>

          {prefill?.startSlot == null && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-600">
                  Duration (minutes)
                </label>
                <select
                  value={manualDuration}
                  onChange={(e) => {
                    setManualDuration(Number(e.target.value));
                    setSelectedSlotIso("");
                  }}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  {[15, 30, 45, 60, 90, 120].map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-600">
                  Available time slot
                </label>
                {slotsLoading ? (
                  <p className="text-xs text-neutral-500">Loading open times…</p>
                ) : slotsError ? (
                  <p className="text-xs text-red-600">{slotsError}</p>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    No open times for this doctor on the selected day.
                  </p>
                ) : (
                  <select
                    value={selectedSlotIso}
                    onChange={(e) => setSelectedSlotIso(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">— select a slot —</option>
                    {slots.map((iso) => (
                      <option key={iso} value={iso}>
                        {formatSlotLabel(iso, durationMinutes)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-600">
              Patient name
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Full patient name"
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
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
                className="flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
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
              <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                Patient: {patient.fullName || `${patient.firstName} ${patient.lastName}`}
              </p>
            )}
            {!patient && phoneNumber.trim() && lookupError && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
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
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {submitError}
            </p>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/60">
          <Button type="button" variant="outline" className="rounded-xl" onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || (prefill?.startSlot == null && !selectedSlotIso)}
            className="rounded-xl bg-[#0066ff] hover:bg-[#0052cc]"
          >
            {isSubmitting ? "Booking…" : "Book appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
