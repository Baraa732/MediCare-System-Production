import {
  absoluteMinutesFromGridMinutes,
  formatAbsoluteRangeLabel,
} from "@/lib/time/gridTime";
import {
  clinicDateKey,
  formatClinicDate,
  formatClinicDateTime,
} from "@/lib/time/clinicTime";
import type { DoctorType } from "@/features/dashboardAssitant/types";
import {
  countActiveScheduleFilters,
  filterDoctorsByScheduleFilters,
  type ScheduleFilters,
} from "@/features/dashboardAssitant/utils/scheduleFilters";
import { clinicNowGridMinutes } from "@/features/dashboardAssitant/utils/editModeDrag";
import { normalizeAppointmentStatus } from "@/features/dashboardAssitant/utils/appointmentStatusStyles";
import type {
  ScheduleExportMeta,
  ScheduleExportRow,
} from "./scheduleExportTypes";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  done: "Done / Checked-in",
  in_progress: "In progress",
  late: "Late",
  pending_request: "Pending",
  "no-show": "No-show",
  cancelled: "Cancelled",
  unavailable: "Unavailable",
};

function displayStatus(raw?: string) {
  const key = normalizeAppointmentStatus(raw);
  return STATUS_LABEL[key] ?? key;
}

function privacySafePatientName(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Guest patient";
  // Keep operational readability; never invent IDs. Strip digits that look like phone fragments.
  return trimmed.replace(/\+?\d[\d\s-]{6,}/g, "").trim() || "Guest patient";
}

function privacySafeReason(reason?: string | null, notes?: string | null): string {
  const text = (reason || notes || "").trim();
  if (!text) return "—";
  // Cap length; strip long digit runs (phones / IDs accidentally pasted into notes).
  return text.replace(/\+?\d[\d\s-]{6,}/g, "[redacted]").slice(0, 80);
}

export function buildScheduleExportDataset(input: {
  doctors: DoctorType[];
  filters: ScheduleFilters;
  selectedDate: Date;
  clinicName?: string;
  exportedBy?: string;
}): { rows: ScheduleExportRow[]; meta: ScheduleExportMeta; dateKey: string } {
  const filtered = filterDoctorsByScheduleFilters(input.doctors, input.filters, {
    nowGridMinutes: clinicNowGridMinutes(input.selectedDate),
    selectedDate: input.selectedDate,
  });

  const flat: Omit<ScheduleExportRow, "rowNumber">[] = [];

  for (const doc of filtered) {
    for (const apt of [...doc.appointments].sort((a, b) => a.start - b.start)) {
      const duration = Math.max(15, apt.end - apt.start);
      flat.push({
        timeRange: formatAbsoluteRangeLabel(
          absoluteMinutesFromGridMinutes(apt.start),
          duration,
        ),
        durationMinutes: duration,
        patientName: privacySafePatientName(apt.patient?.name),
        doctorName: doc.name || "Doctor",
        specialty: doc.specialty?.trim() || "—",
        status: displayStatus(apt.status),
        reason: privacySafeReason(apt.title, apt.notes),
      });
    }
  }

  const rows: ScheduleExportRow[] = flat.map((row, index) => ({
    ...row,
    rowNumber: index + 1,
  }));

  const activeFilters = countActiveScheduleFilters(input.filters);
  const filterSummary = [
    activeFilters > 0 ? `${activeFilters} advanced filter(s)` : "No advanced filters",
    input.filters.query.trim()
      ? `name/phone search active`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const meta: ScheduleExportMeta = {
    clinicName: input.clinicName?.trim() || "MediCare Clinic",
    scheduleDateLabel: formatClinicDate(input.selectedDate),
    generatedAtLabel: formatClinicDateTime(new Date()),
    exportedBy: input.exportedBy?.trim() || "Secretary",
    rowCount: rows.length,
    filterSummary,
  };

  return {
    rows,
    meta,
    dateKey: clinicDateKey(input.selectedDate),
  };
}
