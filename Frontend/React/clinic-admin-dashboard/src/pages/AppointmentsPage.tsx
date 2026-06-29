import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { useAuthStore } from "@/stores/authStore";
import * as appointmentApi from "@/lib/api/appointments";
import { lookupPatientByPhone } from "@/lib/api/users";
import { normalizeCaughtError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Appointments</h1>
          <p className="text-neutral-500 mt-1">Last 30 days · clinic scope</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#0066ff] hover:bg-[#0052cc] rounded-xl h-10">
          <Plus className="w-4 h-4 mr-2" /> New appointment
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-neutral-200 rounded-xl bg-white text-sm">
          <option value="ALL">All statuses</option>
          <option value="REQUESTED">Requested</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_SHOW">No show</option>
        </select>
        <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="px-3 py-2 border border-neutral-200 rounded-xl bg-white text-sm">
          <option value="ALL">All doctors</option>
          {doctors.some((d) => d.userId === userId) && (
            <option value={userId}>My appointments</option>
          )}
          {doctors.map((d) => (
            <option key={d.userId} value={d.userId}>{doctorName(d.userId)}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {message && <p className="text-sm text-[#0066ff] bg-[#ecf3ff] px-4 py-2 rounded-xl">{message}</p>}

      <Card className="ring-neutral-200 overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">No appointments found</td></tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3">{format(parseISO(a.scheduledAt), "MMM d, yyyy HH:mm")}</td>
                    <td className="px-4 py-3">{doctorName(a.doctorId)}</td>
                    <td className="px-4 py-3">{a.durationMinutes} min</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-neutral-100 text-xs font-medium">{a.status}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{a.reason ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {a.status === "REQUESTED" && (
                          <button type="button" onClick={() => void updateStatus(a.id, "CONFIRMED")} className="text-[#0066ff] hover:underline text-xs font-semibold">Confirm</button>
                        )}
                        {a.status === "CONFIRMED" && (
                          <>
                            <button type="button" onClick={() => void updateStatus(a.id, "COMPLETED")} className="text-green-600 hover:underline text-xs font-semibold">Complete</button>
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
        </CardContent>
      </Card>

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
