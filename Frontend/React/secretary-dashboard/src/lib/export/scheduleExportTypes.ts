/**
 * Privacy-safe schedule export model.
 *
 * Research basis (HIPAA minimum-necessary / Safe Harbor guidance):
 * - Never export internal identifiers (appointmentId, patientId, doctorId, clinicId).
 * - Never export phone numbers, emails, or other direct contact identifiers in bulk exports.
 * - Export only operational fields a secretary needs for a day sheet.
 * - Generate files entirely client-side (ExcelJS + pdfmake) so PHI never goes to a third-party API.
 */

export interface ScheduleExportMeta {
  clinicName: string;
  scheduleDateLabel: string;
  generatedAtLabel: string;
  exportedBy: string;
  rowCount: number;
  filterSummary: string;
}

/** Sanitized operational row — no IDs, no phone numbers. */
export interface ScheduleExportRow {
  rowNumber: number;
  timeRange: string;
  durationMinutes: number;
  patientName: string;
  doctorName: string;
  specialty: string;
  status: string;
  reason: string;
}

export const EXPORT_COLUMNS = [
  { key: "rowNumber", header: "#", width: 6 },
  { key: "timeRange", header: "Time", width: 22 },
  { key: "durationMinutes", header: "Duration (min)", width: 14 },
  { key: "patientName", header: "Patient", width: 22 },
  { key: "doctorName", header: "Doctor", width: 22 },
  { key: "specialty", header: "Specialty", width: 18 },
  { key: "status", header: "Status", width: 14 },
  { key: "reason", header: "Reason / note", width: 28 },
] as const;

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function buildExportFilename(
  kind: "xlsx" | "pdf",
  dateKey: string,
): string {
  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[:T]/g, "-");
  return `MediCare-schedule-${dateKey}-${stamp}.${kind}`;
}
