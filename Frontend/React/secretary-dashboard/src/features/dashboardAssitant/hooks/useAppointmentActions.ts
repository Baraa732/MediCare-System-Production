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
import { useAuthStore } from "@/stores/authStore";
import { useScheduleContext } from "../context/ScheduleContext";
import { useHandleDatePicker } from "./useHandleDatePicker";
import type { AppointmentType } from "../types";
import {
  TREATMENT_OPTIONS,
  type WizardFormData,
} from "../CreateAppointmentWizard/useAppointmentWizard";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isApiAppointmentId(id: string) {
  return UUID_RE.test(id);
}

export function useAppointmentActions() {
  const { refetch, selectedDate, clinicId } = useScheduleContext();
  const accessToken = useAuthStore((s) => s.accessToken);
  const changeDate = useHandleDatePicker((s) => s.handleChangeDate);

  const persistGridUpdate = useCallback(
    async (updatedApt: AppointmentType, options?: { skipRefetch?: boolean }) => {
      if (!accessToken || !isApiAppointmentId(updatedApt.id)) {
        return;
      }

      await updateAppointment(
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
        refetch();
      }
    },
    [accessToken, refetch, selectedDate],
  );

  /** Persist many edit-mode moves, then refetch once. Each update emits APPOINTMENT_UPDATED notifications. */
  const persistGridUpdates = useCallback(
    async (updatedApts: AppointmentType[]) => {
      if (!accessToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const apiApts = updatedApts.filter((a) => isApiAppointmentId(a.id));
      // Vacate earlier / lower starts first so chain shifts don't fight each other.
      const ordered = [...apiApts].sort(
        (a, b) => a.docId.localeCompare(b.docId) || a.start - b.start,
      );
      const batchExcludeIds = ordered.map((a) => a.id);

      for (const apt of ordered) {
        await updateAppointment(
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
      }
      refetch();
    },
    [accessToken, refetch, selectedDate],
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
      const notes = encodeAppointmentNotes(wizardData.notes, {
        complexity: wizardData.complexity,
        refuseTransfer: wizardData.isLockedToDoctor,
      });

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
        await updateAppointmentStatus(
          options.pendingRequestId,
          { status: "CONFIRMED" },
          accessToken,
        );
      } else if (options.editingId && isApiAppointmentId(options.editingId)) {
        await updateAppointment(
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
      } else {
        const phone = wizardData.patientPhone.trim();
        const name = wizardData.patientName.trim();
        let patientId: string | undefined;

        try {
          const patient = await lookupPatientByPhone(phone, accessToken);
          patientId = patient.id;
        } catch {
          patientId = undefined;
        }

        await createAppointment(
          {
            clinicId,
            doctorId: wizardData.doctorId,
            patientId,
            guestPatientName: patientId ? undefined : name,
            guestPatientPhone: patientId ? undefined : phone,
            scheduledAt,
            durationMinutes: wizardData.duration,
            reason,
            notes,
          },
          accessToken,
        );
      }

      // Jump the schedule grid to the booked day so the new card is visible.
      changeDate(bookingDate);
      refetch();
    },
    [accessToken, changeDate, clinicId, refetch, selectedDate],
  );

  return {
    persistGridUpdate,
    persistGridUpdates,
    saveWizardAppointment,
    refetch,
  };
}
