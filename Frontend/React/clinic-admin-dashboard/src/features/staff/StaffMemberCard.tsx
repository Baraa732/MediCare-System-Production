import {
  Briefcase,
  Calendar,
  Mail,
  Phone,
  Stethoscope,
  User,
} from "lucide-react";
import type { StaffMember } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  appointmentCountForDoctor,
  formatAssignedDate,
  maskPhone,
  roleLabel,
  staffDisplayName,
  statusTone,
} from "./staffUtils";
import type { ApiAppointment } from "@/lib/api/types";

const ROLE_ICON = {
  DOCTOR: Stethoscope,
  SECRETARY: Briefcase,
  CLINIC_ADMIN: User,
} as const;

type StaffMemberCardProps = {
  member: StaffMember;
  appointments: ApiAppointment[];
  selected?: boolean;
  onSelect: () => void;
};

export function StaffMemberCard({
  member,
  appointments,
  selected,
  onSelect,
}: StaffMemberCardProps) {
  const Icon = ROLE_ICON[member.staffRole as keyof typeof ROLE_ICON] ?? User;
  const tone = statusTone(member.status);
  const apptCount =
    member.staffRole === "DOCTOR"
      ? appointmentCountForDoctor(member.userId, appointments)
      : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left w-full rounded-sm border p-4 transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#c7dcff]",
        selected
          ? "border-[#0066ff] bg-[#ecf3ff]/50 ring-1 ring-[#0066ff]/30"
          : "border-[#edebe9] bg-white hover:border-[#c7dcff]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-sm flex items-center justify-center shrink-0",
            member.staffRole === "DOCTOR"
              ? "bg-[#ecf3ff] text-[#0066ff]"
              : member.staffRole === "SECRETARY"
                ? "bg-violet-50 text-violet-700"
                : "bg-[#f3f2f1] text-[#1a1b1e]",
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm text-[#1a1b1e] truncate">
              {staffDisplayName(member)}
            </p>
            <span
              className={cn(
                "pbi-status-pill shrink-0 text-[10px]",
                tone === "success" && "bg-emerald-50 text-emerald-700",
                tone === "warning" && "bg-amber-50 text-amber-700",
                tone === "neutral" && "bg-[#f3f2f1] text-[#929296]",
              )}
            >
              {member.status ?? "ACTIVE"}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-[#0066ff] mt-0.5">
            {roleLabel(member.staffRole)}
          </p>
          <p className="text-xs text-[#929296] mt-2 truncate">
            {member.staffRole === "DOCTOR"
              ? member.specialization ?? "General practice"
              : member.department ?? member.state ?? "Front desk"}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#929296]">
            <span className="inline-flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {maskPhone(member.phoneNumber)}
            </span>
            {member.email && (
              <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                <Mail className="w-3 h-3 shrink-0" />
                {member.email}
              </span>
            )}
            {apptCount != null && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {apptCount} appts (30d)
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#929296] mt-2">
            Assigned {formatAssignedDate(member.assignedAt)}
          </p>
        </div>
      </div>
    </button>
  );
}
