import { useCallback } from "react";
import {
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
} from "@/lib/api/appointments";
import { lookupPatientByPhone } from "@/lib/api/users";
import { scheduledAtFromGridMinutes } from "@/lib/api/mappers";
import { useAuthStore } from "@/stores/authStore";
import { useScheduleContext } from "../context/ScheduleContext";
import type { AppointmentType } from "../types";
import {
  TREATMENT_OPTIONS,
  type WizardFormData,
} from "../CreateAppointmentWizard/useAppointmentWizard";
import { START_TIME_MINUTES } from "../data/scheduleGrid";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isApiAppointmentId(id: string) {
  return UUID_RE.test(id);
}

export function useAppointmentActions() {
  const { refetch, selectedDate, clinicId } = useScheduleContext();
  const accessToken = useAuthStore((s) => s.accessToken);

  const persistGridUpdate = useCallback(
    async (updatedApt: AppointmentType) => {
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
          notes: updatedApt.notes,
        },
        accessToken,
      );
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

      const gridStart =
        wizardData.timeSlot !== null
          ? wizardData.timeSlot - START_TIME_MINUTES
          : 0;
      const scheduledAt = scheduledAtFromGridMinutes(
        gridStart,
        wizardData.date ?? selectedDate,
      );
      const treatmentName =
        TREATMENT_OPTIONS.find((t) => t.id === wizardData.treatmentId)?.name ??
        "Appointment";
      const reason =
        wizardData.notes?.trim() ||
        `${wizardData.patientName} - ${treatmentName}`;

      if (options.pendingRequestId && isApiAppointmentId(options.pendingRequestId)) {
        await updateAppointment(
          options.pendingRequestId,
          {
            doctorId: wizardData.doctorId,
            scheduledAt,
            durationMinutes: wizardData.duration,
            reason,
            notes: wizardData.notes,
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
            notes: wizardData.notes,
          },
          accessToken,
        );
      } else {
        const patient = await lookupPatientByPhone(
          wizardData.patientPhone.trim(),
          accessToken,
        );
        await createAppointment(
          {
            clinicId,
            doctorId: wizardData.doctorId,
            patientId: patient.id,
            scheduledAt,
            durationMinutes: wizardData.duration,
            reason,
          },
          accessToken,
        );
      }

      refetch();
    },
    [accessToken, clinicId, refetch, selectedDate],
  );

  return { persistGridUpdate, saveWizardAppointment, refetch };
}
