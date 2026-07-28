import { Briefcase, MapPin, Stethoscope, UserCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type StaffRole = "DOCTOR" | "SECRETARY";

export type StaffFormState = {
  phoneNumber: string;
  firstName: string;
  middleName: string;
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
  birthDate: string;
  birthPlace: string;
  nationalId: string;
  maritalStatus: "" | "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
  department: string;
  shift: string;
  languages: string;
};

export const emptyStaffForm = (): StaffFormState => ({
  phoneNumber: "",
  firstName: "",
  middleName: "",
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
  birthDate: "",
  birthPlace: "",
  nationalId: "",
  maritalStatus: "",
  department: "",
  shift: "",
  languages: "",
});

type StaffRoleFormProps = {
  form: StaffFormState;
  onChange: (patch: Partial<StaffFormState>) => void;
};

const selectClass = "h-9 w-full rounded-sm border border-input px-2.5 text-sm";

function Section({
  title,
  icon: Icon,
  children,
  tone = "neutral",
}: {
  title: string;
  icon: typeof UserCircle;
  children: React.ReactNode;
  tone?: "brand" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-sm border p-4 space-y-4",
        tone === "brand"
          ? "border-[#c7dcff] bg-[#ecf3ff]/40"
          : "border-[#edebe9] bg-[#faf9f8]",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5",
          tone === "brand" ? "text-[#0066ff]" : "text-[#929296]",
        )}
      >
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}

export function StaffRoleForm({ form, onChange }: StaffRoleFormProps) {
  return (
    <div className="space-y-4 max-h-[min(70vh,640px)] overflow-y-auto pr-1">
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

      <Section title="Identity & contact" icon={UserCircle}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>First name *</Label>
            <Input value={form.firstName} onChange={(e) => onChange({ firstName: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Middle name</Label>
            <Input value={form.middleName} onChange={(e) => onChange({ middleName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Last name *</Label>
            <Input value={form.lastName} onChange={(e) => onChange({ lastName: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Phone *</Label>
            <Input value={form.phoneNumber} onChange={(e) => onChange({ phoneNumber: e.target.value })} placeholder="09xxxxxxxx" required />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => onChange({ email: e.target.value })} placeholder="work@clinic.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <select value={form.gender} onChange={(e) => onChange({ gender: e.target.value as StaffFormState["gender"] })} className={selectClass}>
              <option value="">Not specified</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Date of birth</Label>
            <Input type="date" value={form.birthDate} onChange={(e) => onChange({ birthDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>National ID</Label>
            <Input value={form.nationalId} onChange={(e) => onChange({ nationalId: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Marital status</Label>
            <select value={form.maritalStatus} onChange={(e) => onChange({ maritalStatus: e.target.value as StaffFormState["maritalStatus"] })} className={selectClass}>
              <option value="">Not specified</option>
              <option value="SINGLE">Single</option>
              <option value="MARRIED">Married</option>
              <option value="DIVORCED">Divorced</option>
              <option value="WIDOWED">Widowed</option>
            </select>
          </div>
        </div>
      </Section>

      {form.role === "DOCTOR" ? (
        <Section title="Clinical credentials" icon={Stethoscope} tone="brand">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Specialization *</Label>
              <Input value={form.specialization} onChange={(e) => onChange({ specialization: e.target.value })} placeholder="e.g. Cardiology, Pediatrics" required />
            </div>
            <div className="space-y-1.5">
              <Label>Medical license #</Label>
              <Input value={form.licenseNumber} onChange={(e) => onChange({ licenseNumber: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Years of experience</Label>
              <Input type="number" min={0} value={form.yearsOfExperience} onChange={(e) => onChange({ yearsOfExperience: e.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Languages spoken</Label>
              <Input value={form.languages} onChange={(e) => onChange({ languages: e.target.value })} placeholder="Arabic, English" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Practice governorate</Label>
              <Input value={form.governorate} onChange={(e) => onChange({ governorate: e.target.value })} />
            </div>
          </div>
        </Section>
      ) : (
        <Section title="Front desk profile" icon={Briefcase}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => onChange({ username: e.target.value })} placeholder="Desk login name" />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => onChange({ department: e.target.value })} placeholder="Reception, Billing" />
            </div>
            <div className="space-y-1.5">
              <Label>Shift</Label>
              <Input value={form.shift} onChange={(e) => onChange({ shift: e.target.value })} placeholder="Morning, Evening" />
            </div>
            <div className="space-y-1.5">
              <Label>Desk / floor</Label>
              <Input value={form.state} onChange={(e) => onChange({ state: e.target.value })} placeholder="Floor 2, Wing A" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Languages</Label>
              <Input value={form.languages} onChange={(e) => onChange({ languages: e.target.value })} placeholder="Arabic, English" />
            </div>
          </div>
        </Section>
      )}

      <Section title="Location" icon={MapPin}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Governorate</Label>
            <Input value={form.governorate} onChange={(e) => onChange({ governorate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>City / area</Label>
            <Input value={form.state} onChange={(e) => onChange({ state: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Street / building</Label>
            <Input value={form.streetInfo} onChange={(e) => onChange({ streetInfo: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Place of birth</Label>
            <Input value={form.birthPlace} onChange={(e) => onChange({ birthPlace: e.target.value })} />
          </div>
        </div>
      </Section>
    </div>
  );
}

export function staffFormToPayload(form: StaffFormState, clinicId: string) {
  const base = {
    phoneNumber: form.phoneNumber.trim(),
    firstName: form.firstName.trim(),
    middleName: form.middleName.trim() || undefined,
    lastName: form.lastName.trim(),
    email: form.email.trim() || undefined,
    role: form.role,
    clinicId,
    governorate: form.governorate.trim() || undefined,
    state: form.state.trim() || undefined,
    streetInfo: form.streetInfo.trim() || undefined,
    gender: form.gender || undefined,
    birthDate: form.birthDate || undefined,
    birthPlace: form.birthPlace.trim() || undefined,
    nationalId: form.nationalId.trim() || undefined,
    maritalStatus: form.maritalStatus || undefined,
  };

  if (form.role === "DOCTOR") {
    return {
      ...base,
      specialization: form.specialization.trim() || undefined,
      licenseNumber: form.licenseNumber.trim() || undefined,
      yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
    };
  }

  return {
    ...base,
    username: form.username.trim() || undefined,
  };
}
