import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { useAuthStore } from "@/stores/authStore";
import * as appointmentApi from "@/lib/api/appointments";
import { lookupPatientByPhone } from "@/lib/api/users";
import { normalizeCaughtError } from "@/lib/api/errors";
import { AlertBanner } from "@/components/layout/PageState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PanelCard } from "@/components/layout/PanelCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PatientLookup } from "@/lib/api/users";

export function AppointmentsPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const userId = useAuthStore((s) => s.userId);
  const clinicId = useAuthStore((s) => s.clinicId ?? s.tenantId)!;
  const { appointments, doctors, loading, error, reload } = useClinicAdmin();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [doctorFilter, setDoctorFilter] = useState("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [patient, setPatient] = useState<PatientLookup | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [reason, setReason] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const doctorName = (id: string) => {
    const d = doctors.find((x) => x.userId === id);
    return d?.fullName ?? d?.firstName ?? id.slice(0, 8);
  };

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (doctorFilter !== "ALL" && a.doctorId !== doctorFilter) return false;
      return true;
    });
  }, [appointments, statusFilter, doctorFilter]);

  const updateStatus = async (id: string, status: appointmentApi.AppointmentStatus) => {
    setMessage(null);
    try {
      await appointmentApi.updateAppointmentStatus(id, { status }, token);
      await reload();
      setMessage(`Appointment marked as ${status.toLowerCase()}.`);
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not update appointment"));
    }
  };

  const handleLookup = async () => {
    setLookupError(null);
    setPatient(null);
    try {
      const result = await lookupPatientByPhone(phoneNumber.trim(), token);
      setPatient(result);
    } catch (err) {
      setLookupError(normalizeCaughtError(err, "Patient not found"));
    }
  };

  const handleCreate = async () => {
    if (!patient || !doctorId || !scheduledAt) {
      setMessage("Patient, doctor, and date/time are required.");
      return;
    }
    setSubmitting(true);
    try {
      await appointmentApi.createAppointment(
        {
          clinicId,
          doctorId,
          patientId: patient.id,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMinutes,
          reason: reason || undefined,
        },
        token,
      );
      setDialogOpen(false);
      setPhoneNumber("");
      setPatient(null);
      setReason("");
      await reload();
      setMessage("Appointment created successfully.");
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not create appointment"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pbi-canvas space-y-4">
      <PageHeader
        title="Appointments"
        subtitle="Last 30 days · filter and manage bookings"
        actions={
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-[#0066ff] hover:bg-[#0052cc] rounded-sm h-9 text-xs font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" /> New appointment
          </Button>
        }
      />

      <div className="flex gap-2 flex-wrap p-3 bg-white border border-[#e1dfdd] rounded-sm">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 px-3 border border-[#e1dfdd] rounded-sm bg-white text-xs font-medium text-[#1a1b1e]"
        >
          <option value="ALL">All statuses</option>
          <option value="REQUESTED">Requested</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_SHOW">No show</option>
        </select>
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="h-8 px-3 border border-[#e1dfdd] rounded-sm bg-white text-xs font-medium text-[#1a1b1e]"
        >
          <option value="ALL">All doctors</option>
          {doctors.some((d) => d.userId === userId) && (
            <option value={userId}>My appointments</option>
          )}
          {doctors.map((d) => (
            <option key={d.userId} value={d.userId}>{doctorName(d.userId)}</option>
          ))}
        </select>
      </div>

      {error && <AlertBanner message={error} tone="error" />}
      {message && <AlertBanner message={message} />}

      <PanelCard title="Appointment list" subtitle={`${filtered.length} records`} noPadding>
        <div className="overflow-x-auto">
          <table className="pbi-data-table min-w-[800px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Doctor</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center text-[#929296] py-10">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-[#929296] py-10">No appointments found</td></tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="tabular-nums">{format(parseISO(a.scheduledAt), "MMM d, yyyy HH:mm")}</td>
                    <td>{doctorName(a.doctorId)}</td>
                    <td>{a.durationMinutes} min</td>
                    <td>
                      <span className="pbi-status-pill bg-[#f3f2f1] text-[#1a1b1e]">{a.status}</span>
                    </td>
                    <td className="max-w-[200px] truncate text-[#929296]">{a.reason ?? "—"}</td>
                    <td>
                      <div className="flex gap-2 flex-wrap">
                        {a.status === "REQUESTED" && (
                          <button type="button" onClick={() => void updateStatus(a.id, "CONFIRMED")} className="text-[#0066ff] hover:underline text-xs font-semibold">Confirm</button>
                        )}
                        {a.status === "CONFIRMED" && (
                          <>
                            <button type="button" onClick={() => void updateStatus(a.id, "COMPLETED")} className="text-emerald-600 hover:underline text-xs font-semibold">Complete</button>
                            <button type="button" onClick={() => void updateStatus(a.id, "NO_SHOW")} className="text-violet-600 hover:underline text-xs font-semibold">No-show</button>
                          </>
                        )}
                        {(a.status === "REQUESTED" || a.status === "CONFIRMED") && (
                          <button type="button" onClick={() => void updateStatus(a.id, "CANCELLED")} className="text-red-600 hover:underline text-xs font-semibold">Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PanelCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Book appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Patient phone</Label>
              <div className="flex gap-2">
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="09xxxxxxxx" />
                <Button type="button" variant="outline" onClick={() => void handleLookup()}>Lookup</Button>
              </div>
              {lookupError && <p className="text-xs text-red-600">{lookupError}</p>}
              {patient && (
                <p className="text-xs text-green-700">Found: {patient.fullName ?? `${patient.firstName} ${patient.lastName}`}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Doctor</Label>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="h-8 w-full rounded-lg border border-input px-2.5 text-sm">
                <option value="">Select doctor</option>
                {doctors.map((d) => (
                  <option key={d.userId} value={d.userId}>{doctorName(d.userId)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Date & time</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input type="number" min={15} max={120} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={submitting} className="bg-[#0066ff] hover:bg-[#0052cc]">
              {submitting ? "Booking…" : "Book"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
