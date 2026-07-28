import type { ApiAppointment, StaffMember } from "@/lib/api/types";

export function staffDisplayName(member: StaffMember): string {
  return (
    member.fullName?.trim() ||
    `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() ||
    "Unnamed"
  );
}

/** Partial phone mask for list views (HIPAA-conscious glance display). */
export function maskPhone(phone?: string): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `${phone.slice(0, 4)}•••${digits.slice(-3)}`;
}

export function roleLabel(role: string): string {
  switch (role) {
    case "DOCTOR":
      return "Doctor";
    case "SECRETARY":
      return "Secretary";
    case "CLINIC_ADMIN":
      return "Clinic admin";
    default:
      return role.replace("_", " ");
  }
}

export function statusTone(status?: string): "success" | "warning" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED" || status === "PENDING") return "warning";
  return "neutral";
}

export function appointmentCountForDoctor(
  doctorId: string,
  appointments: ApiAppointment[],
): number {
  return appointments.filter((a) => a.doctorId === doctorId).length;
}

export function formatAssignedDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}
