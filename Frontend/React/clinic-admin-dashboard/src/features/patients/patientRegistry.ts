import { compareDesc, isFuture, parseISO } from "date-fns";
import type { ApiAppointment } from "@/lib/api/types";
import type { PatientLookup } from "@/lib/api/users";

export type PatientRegistryItem = {
  patientId: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  status?: string;
  appointmentCount: number;
  lastVisit: string | null;
  nextVisit: string | null;
  doctorIds: string[];
  visitStatuses: string[];
  source: "appointments" | "lookup";
};

export type PatientSortKey = "lastVisit" | "appointments" | "name";

export function patientDisplayName(item: PatientRegistryItem): string {
  if (item.fullName?.trim()) return item.fullName.trim();
  const composed = `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim();
  if (composed) return composed;
  return `Patient ${item.patientId.slice(0, 8)}`;
}

export function buildPatientRegistry(appointments: ApiAppointment[]): PatientRegistryItem[] {
  const map = new Map<string, PatientRegistryItem>();

  for (const apt of appointments) {
    const existing = map.get(apt.patientId);
    const scheduled = apt.scheduledAt;

    if (!existing) {
      map.set(apt.patientId, {
        patientId: apt.patientId,
        appointmentCount: 1,
        lastVisit: scheduled,
        nextVisit: isFuture(parseISO(scheduled)) ? scheduled : null,
        doctorIds: [apt.doctorId],
        visitStatuses: [apt.status],
        source: "appointments",
      });
      continue;
    }

    existing.appointmentCount += 1;
    if (!existing.doctorIds.includes(apt.doctorId)) {
      existing.doctorIds.push(apt.doctorId);
    }
    if (!existing.visitStatuses.includes(apt.status)) {
      existing.visitStatuses.push(apt.status);
    }

    if (!existing.lastVisit || compareDesc(parseISO(scheduled), parseISO(existing.lastVisit)) > 0) {
      if (!isFuture(parseISO(scheduled))) {
        existing.lastVisit = scheduled;
      }
    }

    if (isFuture(parseISO(scheduled))) {
      if (!existing.nextVisit || compareDesc(parseISO(existing.nextVisit), parseISO(scheduled)) < 0) {
        existing.nextVisit = scheduled;
      }
    }
  }

  return Array.from(map.values());
}

export function mergeLookupIntoRegistry(
  registry: PatientRegistryItem[],
  lookup: PatientLookup,
): PatientRegistryItem[] {
  const existing = registry.find((p) => p.patientId === lookup.id);
  if (existing) {
    return registry.map((p) =>
      p.patientId === lookup.id
        ? {
            ...p,
            phoneNumber: lookup.phoneNumber,
            firstName: lookup.firstName,
            lastName: lookup.lastName,
            fullName: lookup.fullName,
            status: lookup.status,
            source: "lookup" as const,
          }
        : p,
    );
  }

  return [
    {
      patientId: lookup.id,
      phoneNumber: lookup.phoneNumber,
      firstName: lookup.firstName,
      lastName: lookup.lastName,
      fullName: lookup.fullName,
      status: lookup.status,
      appointmentCount: 0,
      lastVisit: null,
      nextVisit: null,
      doctorIds: [],
      visitStatuses: [],
      source: "lookup",
    },
    ...registry,
  ];
}

export function filterPatients(
  patients: PatientRegistryItem[],
  {
    query,
    doctorId,
    visitFilter,
    statusFilter,
  }: {
    query: string;
    doctorId: string;
    visitFilter: "ALL" | "UPCOMING" | "RECENT";
    statusFilter: string;
  },
): PatientRegistryItem[] {
  const q = query.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");

  return patients.filter((p) => {
    if (doctorId !== "ALL" && !p.doctorIds.includes(doctorId)) return false;

    if (visitFilter === "UPCOMING" && !p.nextVisit) return false;
    if (visitFilter === "RECENT" && !p.lastVisit) return false;

    if (statusFilter !== "ALL" && !p.visitStatuses.includes(statusFilter)) return false;

    if (!q) return true;

    const name = patientDisplayName(p).toLowerCase();
    const id = p.patientId.toLowerCase();
    const phone = (p.phoneNumber ?? "").replace(/\D/g, "");

    return (
      name.includes(q) ||
      id.includes(q) ||
      (qDigits.length >= 3 && phone.includes(qDigits)) ||
      p.patientId.slice(0, 8).toLowerCase().includes(q)
    );
  });
}

export function sortPatients(
  patients: PatientRegistryItem[],
  sortKey: PatientSortKey,
): PatientRegistryItem[] {
  const next = [...patients];
  next.sort((a, b) => {
    if (sortKey === "appointments") {
      return b.appointmentCount - a.appointmentCount;
    }
    if (sortKey === "name") {
      return patientDisplayName(a).localeCompare(patientDisplayName(b));
    }
    const aTime = a.lastVisit ? parseISO(a.lastVisit).getTime() : 0;
    const bTime = b.lastVisit ? parseISO(b.lastVisit).getTime() : 0;
    return bTime - aTime;
  });
  return next;
}

export function appointmentsForPatient(
  appointments: ApiAppointment[],
  patientId: string,
): ApiAppointment[] {
  return appointments
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => compareDesc(parseISO(a.scheduledAt), parseISO(b.scheduledAt)));
}
