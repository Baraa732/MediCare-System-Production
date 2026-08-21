import { format, parseISO } from "date-fns";
import {
  Calendar,
  Hash,
  Phone,
  Stethoscope,
  User,
} from "lucide-react";
import { Link } from "react-router";
import type { ApiAppointment, ClinicDoctor } from "@/lib/api/types";
import {
  appointmentsForPatient,
  patientDisplayName,
  type PatientRegistryItem,
} from "./patientRegistry";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  REQUESTED: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-[#ecf3ff] text-[#0066ff]",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
  NO_SHOW: "bg-violet-50 text-violet-700",
};

type PatientDetailPanelProps = {
  patient: PatientRegistryItem | null;
  appointments: ApiAppointment[];
  doctors: ClinicDoctor[];
  onClose: () => void;
};

function doctorName(doctors: ClinicDoctor[], id: string) {
  const d = doctors.find((x) => x.userId === id);
  if (d?.fullName) return d.fullName;
  if (d?.firstName) return d.firstName;
  return id?.trim() ? id.slice(0, 8) : "Unknown";
}

export function PatientDetailPanel({
  patient,
  appointments,
  doctors,
  onClose,
}: PatientDetailPanelProps) {
  if (!patient) {
    return (
      <div className="pbi-panel h-full min-h-[320px] flex flex-col items-center justify-center text-center p-8">
        <div className="w-12 h-12 rounded-sm bg-[#ecf3ff] flex items-center justify-center mb-3">
          <User className="w-6 h-6 text-[#0066ff]" />
        </div>
        <p className="text-sm font-semibold text-[#1a1b1e]">Select a patient</p>
        <p className="text-xs text-[#929296] mt-1 max-w-[220px]">
          Choose from the list or search by phone to view visit history.
        </p>
      </div>
    );
  }

  const history = appointmentsForPatient(appointments, patient.patientId);
  const name = patientDisplayName(patient);

  return (
    <div className="pbi-panel h-full flex flex-col overflow-hidden">
      <header className="pbi-panel-header shrink-0">
        <div className="min-w-0">
          <h2 className="pbi-panel-title truncate">{name}</h2>
          <p className="pbi-panel-subtitle">Patient workspace</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-[#929296] hover:text-[#1a1b1e]"
        >
          Clear
        </button>
      </header>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#929296] flex items-center gap-1">
              <Hash className="w-3 h-3" /> ID
            </p>
            <p className="text-xs font-mono mt-1 break-all">{patient.patientId}</p>
          </div>
          <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#929296]">Visits</p>
            <p className="text-lg font-semibold mt-0.5 tabular-nums">{patient.appointmentCount}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {patient.phoneNumber && (
            <p className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-[#929296]" />
              <span className="font-medium">{patient.phoneNumber}</span>
            </p>
          )}
          {patient.status && (
            <p>
              <span className="text-[#929296]">Account:</span>{" "}
              <span className="pbi-status-pill bg-[#ecf3ff] text-[#0066ff]">{patient.status}</span>
            </p>
          )}
          {patient.lastVisit && (
            <p className="flex items-center gap-2 text-[#929296]">
              <Calendar className="w-3.5 h-3.5" />
              Last visit {format(parseISO(patient.lastVisit), "MMM d, yyyy")}
            </p>
          )}
          {patient.nextVisit && (
            <p className="flex items-center gap-2 text-[#0066ff] font-medium">
              <Calendar className="w-3.5 h-3.5" />
              Upcoming {format(parseISO(patient.nextVisit), "MMM d, HH:mm")}
            </p>
          )}
        </div>

        {patient.doctorIds.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#929296] mb-2 flex items-center gap-1">
              <Stethoscope className="w-3 h-3" /> Doctors seen
            </p>
            <div className="flex flex-wrap gap-1.5">
              {patient.doctorIds.map((id) => (
                <span
                  key={id}
                  className="text-xs px-2 py-1 rounded-sm bg-[#f3f2f1] text-[#1a1b1e] font-medium"
                >
                  {doctorName(doctors, id)}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#929296] mb-2">
            Visit history
          </p>
          {history.length === 0 ? (
            <p className="text-xs text-[#929296] py-4 text-center border border-dashed border-[#e1dfdd] rounded-sm">
              No appointments in the last 30 days.
            </p>
          ) : (
            <ul className="space-y-2">
              {history.slice(0, 8).map((apt) => (
                <li
                  key={apt.id}
                  className="flex items-start justify-between gap-2 rounded-sm border border-[#edebe9] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tabular-nums">
                      {format(parseISO(apt.scheduledAt), "MMM d, HH:mm")}
                    </p>
                    <p className="text-[11px] text-[#929296] truncate">
                      {doctorName(doctors, apt.doctorId)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "pbi-status-pill shrink-0",
                      STATUS_CLASS[apt.status] ?? "bg-[#f3f2f1] text-[#1a1b1e]",
                    )}
                  >
                    {apt.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {history.length > 0 && (
            <Link
              to="/dashboard/appointments"
              className="inline-block mt-3 text-xs font-semibold text-[#0066ff] hover:underline"
            >
              Open appointments →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
