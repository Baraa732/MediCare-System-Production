import {
  Briefcase,
  Calendar,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Shield,
  Stethoscope,
  UserMinus,
  UserX,
} from "lucide-react";
import type { ApiAppointment, StaffMember } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { PanelCard } from "@/components/layout/PanelCard";
import {
  appointmentCountForDoctor,
  formatAssignedDate,
  roleLabel,
  staffDisplayName,
} from "./staffUtils";

type StaffDetailPanelProps = {
  member: StaffMember | null;
  appointments: ApiAppointment[];
  onSuspend: (userId: string, status?: string) => void;
  onRemove: (userId: string) => void;
};

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value?: string | number | null;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start gap-2 py-2 border-b border-[#f3f2f1] last:border-0">
      <Icon className="w-4 h-4 text-[#929296] shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-[#929296]">{label}</p>
        <p className="text-sm text-[#1a1b1e] break-words">{value}</p>
      </div>
    </div>
  );
}

export function StaffDetailPanel({
  member,
  appointments,
  onSuspend,
  onRemove,
}: StaffDetailPanelProps) {
  if (!member) {
    return (
      <PanelCard title="Staff profile" subtitle="Select a team member">
        <p className="text-sm text-[#929296] py-8 text-center">
          Choose a card from the directory to view credentials, contact details, and
          workforce actions.
        </p>
      </PanelCard>
    );
  }

  const apptCount =
    member.staffRole === "DOCTOR"
      ? appointmentCountForDoctor(member.userId, appointments)
      : null;

  return (
    <PanelCard
      title={staffDisplayName(member)}
      subtitle={`${roleLabel(member.staffRole)} · tenant workforce record`}
      actions={
        member.staffRole !== "CLINIC_ADMIN" ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-sm text-xs"
              onClick={() => onSuspend(member.userId, member.status)}
            >
              {member.status === "SUSPENDED" ? (
                <>
                  <Shield className="w-3.5 h-3.5 mr-1" /> Activate
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5 mr-1" /> Suspend
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-sm text-xs text-red-600 border-red-100 hover:bg-red-50"
              onClick={() => onRemove(member.userId)}
            >
              <UserMinus className="w-3.5 h-3.5 mr-1" /> Remove
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-1">
        <DetailRow icon={Phone} label="Phone" value={member.phoneNumber} />
        <DetailRow icon={Mail} label="Email" value={member.email} />
        <DetailRow icon={Briefcase} label="Username / desk" value={member.username} />
        <DetailRow
          icon={Stethoscope}
          label="Specialization"
          value={member.specialization}
        />
        <DetailRow icon={IdCard} label="License" value={member.licenseNumber} />
        <DetailRow
          icon={Calendar}
          label="Experience"
          value={
            member.yearsOfExperience != null
              ? `${member.yearsOfExperience} years`
              : undefined
          }
        />
        <DetailRow icon={MapPin} label="Location" value={[member.governorate, member.state, member.streetInfo].filter(Boolean).join(" · ") || undefined} />
        <DetailRow icon={Briefcase} label="Department / shift" value={[member.department, member.shift].filter(Boolean).join(" · ") || undefined} />
        <DetailRow icon={IdCard} label="National ID" value={member.nationalId} />
        <DetailRow icon={Calendar} label="Date of birth" value={member.birthDate} />
        <DetailRow icon={Calendar} label="Assigned to clinic" value={formatAssignedDate(member.assignedAt)} />
        {apptCount != null && (
          <DetailRow icon={Calendar} label="Appointments (30d)" value={apptCount} />
        )}
      </div>
      <p className="text-[11px] text-[#929296] mt-4 leading-relaxed border-t border-[#edebe9] pt-3">
        Workforce data is scoped to your clinic tenant only. Suspending access stops
        sign-in without deleting the user record.
      </p>
    </PanelCard>
  );
}
