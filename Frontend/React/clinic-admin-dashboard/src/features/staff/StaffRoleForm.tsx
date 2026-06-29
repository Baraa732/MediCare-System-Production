import { Briefcase, MapPin, Stethoscope, UserCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type StaffRole = "DOCTOR" | "SECRETARY";

export type StaffFormState = {
  phoneNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  role: StaffRole;
  username: string;
  specialization: string;
  licenseNumber: string;
  yearsOfExperience: string;
  governorate: string;
  state: string;
  streetInfo: string;
  gender: "" | "MALE" | "FEMALE" | "OTHER";
};

export const emptyStaffForm = (): StaffFormState => ({
  phoneNumber: "",
  firstName: "",
  lastName: "",
  email: "",
  role: "SECRETARY",
  username: "",
  specialization: "",
  licenseNumber: "",
  yearsOfExperience: "",
  governorate: "",
  state: "",
  streetInfo: "",
  gender: "",
});

type StaffRoleFormProps = {
  form: StaffFormState;
  onChange: (patch: Partial<StaffFormState>) => void;
};

const selectClass = "h-8 w-full rounded-sm border border-input px-2.5 text-sm";

export function StaffRoleForm({ form, onChange }: StaffRoleFormProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-0.5 bg-[#f3f2f1] rounded-sm w-fit">
        {(
          [
            { id: "SECRETARY" as const, label: "Secretary", icon: Briefcase },
            { id: "DOCTOR" as const, label: "Doctor", icon: Stethoscope },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange({ role: id })}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm transition-all",
              form.role === id
                ? "bg-white text-[#0066ff] shadow-sm"
                : "text-[#929296] hover:text-[#1a1b1e]",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>First name</Label>
          <Input
            value={form.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Last name</Label>
          <Input
            value={form.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input
            value={form.phoneNumber}
            onChange={(e) => onChange({ phoneNumber: e.target.value })}
            placeholder="09xxxxxxxx"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="optional"
          />
        </div>
      </div>

      {form.role === "DOCTOR" ? (
        <div className="rounded-sm border border-[#c7dcff] bg-[#ecf3ff]/40 p-4 space-y-4 staff-role-panel">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#0066ff] flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5" /> Doctor credentials
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Specialization *</Label>
              <Input
                value={form.specialization}
                onChange={(e) => onChange({ specialization: e.target.value })}
                placeholder="e.g. Cardiology, Pediatrics"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>License number</Label>
              <Input
                value={form.licenseNumber}
                onChange={(e) => onChange({ licenseNumber: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Years of experience</Label>
              <Input
                type="number"
                min={0}
                value={form.yearsOfExperience}
                onChange={(e) => onChange({ yearsOfExperience: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <select
                value={form.gender}
                onChange={(e) => onChange({ gender: e.target.value as StaffFormState["gender"] })}
                className={selectClass}
              >
                <option value="">Not specified</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Practice governorate</Label>
              <Input
                value={form.governorate}
                onChange={(e) => onChange({ governorate: e.target.value })}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-4 space-y-4 staff-role-panel">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#929296] flex items-center gap-1.5">
            <UserCircle className="w-3.5 h-3.5" /> Secretary desk profile
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) => onChange({ username: e.target.value })}
                placeholder="Desk login name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Desk / floor</Label>
              <Input
                value={form.state}
                onChange={(e) => onChange({ state: e.target.value })}
                placeholder="e.g. Reception, Floor 2"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#929296]" /> Governorate
              </Label>
              <Input
                value={form.governorate}
                onChange={(e) => onChange({ governorate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Street / building</Label>
              <Input
                value={form.streetInfo}
                onChange={(e) => onChange({ streetInfo: e.target.value })}
                placeholder="Clinic address details for this desk"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function staffFormToPayload(form: StaffFormState, clinicId: string) {
  const base = {
    phoneNumber: form.phoneNumber.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim() || undefined,
    role: form.role,
    clinicId,
    governorate: form.governorate.trim() || undefined,
    state: form.state.trim() || undefined,
    streetInfo: form.streetInfo.trim() || undefined,
    gender: form.gender || undefined,
  };

  if (form.role === "DOCTOR") {
    return {
      ...base,
      specialization: form.specialization.trim() || undefined,
      licenseNumber: form.licenseNumber.trim() || undefined,
      yearsOfExperience: form.yearsOfExperience
        ? Number(form.yearsOfExperience)
        : undefined,
    };
  }

  return {
    ...base,
    username: form.username.trim() || undefined,
  };
}
