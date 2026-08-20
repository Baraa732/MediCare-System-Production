import { useScheduleContext } from "../context/ScheduleContext";
import {
  formatFullLocalDate,
  formatMinutesToAMPM,
} from "../components/SchedualeGrid/DNDGrid/utils/timeFormatters";
import { TREATMENT_OPTIONS, type WizardFormData } from "./useAppointmentWizard";

interface Step3ReviewSummaryType {
  formData: WizardFormData;
  computedDuration: number;
  computedPrice: number;
}

export function Step3ReviewSummary({
  formData,
  computedDuration,
  computedPrice,
}: Step3ReviewSummaryType) {
  const { doctors } = useScheduleContext();
  const treatmentName =
    TREATMENT_OPTIONS.find((t) => t.id === formData.treatmentId)?.name || "";
  const doctorName =
    doctors.find((d) => d.id === formData.doctorId)?.name || "";

  const summaryRows = [
    { label: "Treatment", value: treatmentName },
    { label: "Complexity", value: formData.complexity, isCapitalize: true },
    { label: "Duration", value: `${computedDuration} minutes` },
    { label: "Doctor", value: doctorName },
    { label: "Require Doctor", value: formData.isLockedToDoctor },
    { label: "Date", value: formatFullLocalDate(new Date(formData.date)) },
    {
      label: "Time",
      value:
        formData.timeSlot !== null
          ? formatMinutesToAMPM(formData.timeSlot)
          : "",
    },
    {
      label: "Price",
      value: `${computedPrice.toLocaleString()} SYP`,
      isBold: true,
    },
    { label: "Patient Name", value: formData.patientName || "—" },
    { label: "Contact Number", value: formData.patientPhone || "—" },
    { label: "Patient Age", value: formData.patientAge || "—" },
    {
      label: "Gender",
      value: formData.patientGender || "—",
      isCapitalize: true,
    },
    { label: "Address", value: formData.patientAddress || "—" },
    { label: "Notes", value: formData.notes || "—" },
  ];

  return (
    <div className="bg-neutral-50/50 border border-neutral-200/60 rounded-xl p-4 space-y-3 animate-in fade-in duration-200 select-none">
      {summaryRows.map((row, idx) => (
        <div
          key={idx}
          className="flex items-start justify-between text-xs border-b border-neutral-100/70 pb-2 last:border-none last:pb-0"
        >
          <span className="text-neutral-400 font-bold shrink-0">
            {row.label}
          </span>
          <span
            className={`text-neutral-800 text-left pl-2 ${row.isCapitalize ? "capitalize" : ""} ${row.isBold ? "font-bold text-blue-600" : "font-medium"}`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
