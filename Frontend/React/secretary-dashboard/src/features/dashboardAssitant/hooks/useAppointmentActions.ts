import { useCallback } from "react";
import {
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
} from "@/lib/api/appointments";
import { lookupPatientByPhone } from "@/lib/api/users";
import {
  scheduledAtFromAbsoluteMinutes,
  scheduledAtFromGridMinutes,
  encodeAppointmentNotes,
} from "@/lib/api/mappers";
import { normalizeSyrianPhone } from "@/lib/phone";
import { emitStaffRealtime } from "@/lib/realtimeEvents";
import { useAuthStore } from "@/stores/authStore";
import { useScheduleContext } from "../context/ScheduleContext";
import { useHandleDatePicker } from "./useHandleDatePicker";
import type { AppointmentType } from "../types";
import type { EnrichedAppointment } from "@/lib/api/types";
import {
  TREATMENT_OPTIONS,
  type WizardFormData,
} from "../CreateAppointmentWizard/useAppointmentWizard";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isApiAppointmentId(id: string) {
  return UUID_RE.test(id);
}

function publishAppointment(appointment: EnrichedAppointment) {
  emitStaffRealtime({
    source: "local-mutation",
    action: "upsert",
    appointmentId: appointment.id,
    appointment,
    category: appointment.status === "REQUESTED" ? "APPOINTMENT_REQUEST" : "APPOINTMENT",
  });
}

function wizardNoteMeta(wizardData: WizardFormData) {
  const ageValue = parseInt(wizardData.patientAge, 10);
  return {
    complexity: wizardData.complexity,
    refuseTransfer: wizardData.isLockedToDoctor,
    patientGender: wizardData.patientGender,
    patientAge: Number.isFinite(ageValue) ? ageValue : undefined,
  };
}

export function useAppointmentActions() {
  const {
    softRefetch,
    applyAppointmentLocally,
    selectedDate,
    clinicId,
    refetch,
  } = useScheduleContext();
  const accessToken = useAuthStore((s) => s.accessToken);
  const changeDate = useHandleDatePicker((s) => s.handleChangeDate);

  const syncLocalAndBackground = useCallback(
    (appointment?: EnrichedAppointment | null) => {
      if (appointment) {
        applyAppointmentLocally(appointment);
        publishAppointment(appointment);
      }
      // Confirm with server in background — do not block UI.
      void softRefetch();
    },
    [applyAppointmentLocally, softRefetch],
  );

  const persistGridUpdate = useCallback(
    async (updatedApt: AppointmentType, options?: { skipRefetch?: boolean }) => {
      if (!accessToken || !isApiAppointmentId(updatedApt.id)) {
        return;
      }

      const res = await updateAppointment(
        updatedApt.id,
        {
          doctorId: updatedApt.docId,
          scheduledAt: scheduledAtFromGridMinutes(
            updatedApt.start,
            selectedDate,
          ),
          durationMinutes: updatedApt.end - updatedApt.start,
          reason: updatedApt.title,
          notes: encodeAppointmentNotes(updatedApt.notes, {
            complexity: updatedApt.complexity,
            refuseTransfer: updatedApt.refuseTransfer,
          }),
        },
        accessToken,
      );
      if (!options?.skipRefetch) {
        syncLocalAndBackground(res.appointment);
      }
    },
    [accessToken, selectedDate, syncLocalAndBackground],
  );

  /** Persist many edit-mode moves, then soft-sync once. */
  const persistGridUpdates = useCallback(
    async (updatedApts: AppointmentType[]) => {
      if (!accessToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const apiApts = updatedApts.filter((a) => isApiAppointmentId(a.id));
      const ordered = [...apiApts].sort(
        (a, b) => a.docId.localeCompare(b.docId) || a.start - b.start,
      );
      const batchExcludeIds = ordered.map((a) => a.id);

      let last: EnrichedAppointment | undefined;
      for (const apt of ordered) {
        const res = await updateAppointment(
          apt.id,
          {
            doctorId: apt.docId,
            scheduledAt: scheduledAtFromGridMinutes(apt.start, selectedDate),
            durationMinutes: apt.end - apt.start,
            reason: apt.title,
            notes: encodeAppointmentNotes(apt.notes, {
              complexity: apt.complexity,
              refuseTransfer: apt.refuseTransfer,
            }),
            excludeAppointmentIds: batchExcludeIds,
          },
          accessToken,
        );
        if (res.appointment) {
          applyAppointmentLocally(res.appointment);
          last = res.appointment;
        }
      }
      if (last) {
        publishAppointment(last);
      } else {
        emitStaffRealtime({ source: "local-mutation", action: "refresh" });
      }
      void softRefetch();
    },
    [accessToken, applyAppointmentLocally, selectedDate, softRefetch],
  );

  const saveWizardAppointment = useCallback(
    async (
      wizardData: WizardFormData,
      options: {
        editingId?: string;
        pendingRequestId?: string;
      },
    ) => {
      if (!accessToken || !clinicId) {
        throw new Error("Your session has expired. Please sign in again.");
      }
      if (!wizardData.date) {
        throw new Error("Please select an appointment date.");
      }
      if (wizardData.timeSlot == null) {
        throw new Error("Please select an available time slot.");
      }

      const bookingDate = wizardData.date;
      const scheduledAt = scheduledAtFromAbsoluteMinutes(
        wizardData.timeSlot,
        bookingDate,
      );
      const treatmentName =
        TREATMENT_OPTIONS.find((t) => t.id === wizardData.treatmentId)?.name ??
        "Appointment";
      const reason =
        wizardData.notes?.trim() ||
        `${wizardData.patientName} - ${treatmentName}`;
      const notes = encodeAppointmentNotes(wizardData.notes, wizardNoteMeta(wizardData));

      let saved: EnrichedAppointment | undefined;

      if (options.pendingRequestId && isApiAppointmentId(options.pendingRequestId)) {
        await updateAppointment(
          options.pendingRequestId,
          {
            doctorId: wizardData.doctorId,
            scheduledAt,
            durationMinutes: wizardData.duration,
            reason,
            notes,
          },
          accessToken,
        );
        const statusRes = await updateAppointmentStatus(
          options.pendingRequestId,
          { status: "CONFIRMED" },
          accessToken,
        );
        saved = statusRes.appointment;
      } else if (options.editingId && isApiAppointmentId(options.editingId)) {
        const res = await updateAppointment(
          options.editingId,
          {
            doctorId: wizardData.doctorId,
            scheduledAt,
            durationMinutes: wizardData.duration,
            reason,
            notes,
          },
          accessToken,
        );
        saved = res.appointment;
      } else {
        let phone: string;
        try {
          phone = normalizeSyrianPhone(wizardData.patientPhone);
        } catch {
          throw new Error(
            "Enter a valid Syrian phone number (09… or +963…).",
          );
        }
        const name = wizardData.patientName.trim();
        if (!name) {
          throw new Error("Enter the patient's name.");
        }
        let patientId: string | undefined;

        try {
          const patient = await lookupPatientByPhone(phone, accessToken);
          patientId = patient.id;
        } catch {
          patientId = undefined;
        }

        const res = await createAppointment(
          {
            clinicId,
            doctorId: wizardData.doctorId,
            patientId,
            guestPatientName: patientId ? undefined : name,
            guestPatientPhone: patientId ? undefined : phone,
            scheduledAt,
            durationMinutes: Math.max(
              5,
              Math.min(240, Math.round(wizardData.duration || 30)),
            ),
            reason,
            notes,
          },
          accessToken,
        );
        saved = res.appointment
          ? {
              ...res.appointment,
              patientName:
                res.appointment.patientName ??
                (patientId ? name : res.appointment.guestPatientName) ??
                name,
              patientPhone:
                res.appointment.patientPhone ??
                (patientId ? phone : res.appointment.guestPatientPhone) ??
                phone,
            }
          : undefined;
      }

      // Show on grid immediately for the booked day.
      changeDate(bookingDate);
      syncLocalAndBackground(saved);
    },
    [
      accessToken,
      changeDate,
      clinicId,
      syncLocalAndBackground,
    ],
  );

  return {
    persistGridUpdate,
    persistGridUpdates,
    saveWizardAppointment,
    refetch,
    softRefetch,
  };
}
