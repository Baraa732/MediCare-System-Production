import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { createClinicStaff } from "@/lib/api/auth";
import * as clinicApi from "@/lib/api/clinics";
import * as userApi from "@/lib/api/users";
import { normalizeCaughtError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StaffPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const clinicId = useAuthStore((s) => s.clinicId ?? s.tenantId)!;
  const { staff, reload, loading, error } = useClinicAdmin();

  const [form, setForm] = useState({
    phoneNumber: "",
    firstName: "",
    lastName: "",
    email: "",
    role: "SECRETARY" as "SECRETARY" | "DOCTOR" | "CLINIC_ADMIN",
    specialization: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await createClinicStaff(
        {
          ...form,
          clinicId,
          email: form.email || undefined,
          specialization: form.role === "DOCTOR" ? form.specialization || undefined : undefined,
        },
        token,
      );
      const hint = result.whatsappSent
        ? "Credentials sent via WhatsApp."
        : result.whatsappHint ?? "Share credentials manually.";
      setMessage(`${result.message} ${hint}`);
      setForm({
        phoneNumber: "",
        firstName: "",
        lastName: "",
        email: "",
        role: "SECRETARY",
        specialization: "",
      });
      await reload();
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not create staff member"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this staff member from the clinic?")) return;
    try {
      await clinicApi.removeStaff(clinicId, userId, token);
      await reload();
      setMessage("Staff member removed.");
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not remove staff member"));
    }
  };

  const handleStatusToggle = async (userId: string, current?: string) => {
    const next = current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await userApi.updateUserStatus(userId, next, token);
      await reload();
      setMessage(`User status updated to ${next}.`);
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not update user status"));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Staff management</h1>
        <p className="text-neutral-500 mt-1">Create, assign, and manage clinic staff</p>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {message && (
        <p className="text-sm text-[#0066ff] bg-[#ecf3ff] px-4 py-2 rounded-xl">{message}</p>
      )}

      <Card className="ring-neutral-200">
        <CardHeader><CardTitle>Add staff member</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleCreate(e)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phoneNumber} onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email (optional)</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as typeof form.role }))}
                className="h-8 w-full rounded-lg border border-input px-2.5 text-sm"
              >
                <option value="SECRETARY">Secretary</option>
                <option value="DOCTOR">Doctor</option>
                <option value="CLINIC_ADMIN">Clinic admin</option>
              </select>
            </div>
            {form.role === "DOCTOR" && (
              <div className="space-y-1.5">
                <Label>Specialization</Label>
                <Input value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} />
              </div>
            )}
            <div className="md:col-span-2">
              <Button type="submit" disabled={submitting} className="bg-[#0066ff] hover:bg-[#0052cc] rounded-xl h-11 px-6">
                {submitting ? "Creating…" : "Create & send credentials"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="ring-neutral-200 overflow-hidden">
        <CardHeader><CardTitle>Clinic staff</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">Loading…</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-500">No staff assigned yet</td></tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.userId} className="border-t border-neutral-100">
                    <td className="px-4 py-3">{member.fullName ?? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()}</td>
                    <td className="px-4 py-3">{member.staffRole}</td>
                    <td className="px-4 py-3">{member.phoneNumber ?? "—"}</td>
                    <td className="px-4 py-3">{member.status ?? "ACTIVE"}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button type="button" onClick={() => void handleStatusToggle(member.userId, member.status)} className="text-[#0066ff] hover:underline text-xs font-semibold">
                        {member.status === "SUSPENDED" ? "Activate" : "Suspend"}
                      </button>
                      <button type="button" onClick={() => void handleRemove(member.userId)} className="text-red-600 hover:underline text-xs font-semibold">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
