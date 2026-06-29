import { useMemo, useState } from "react";
import { RefreshCw, Stethoscope, UserCog, Users } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { createClinicStaff } from "@/lib/api/auth";
import * as clinicApi from "@/lib/api/clinics";
import * as userApi from "@/lib/api/users";
import { normalizeCaughtError } from "@/lib/api/errors";
import { AlertBanner } from "@/components/layout/PageState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PanelCard } from "@/components/layout/PanelCard";
import { KpiTile } from "@/components/layout/KpiTile";
import {
  StaffRoleForm,
  emptyStaffForm,
  staffFormToPayload,
  type StaffFormState,
} from "@/features/staff/StaffRoleForm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ROLE_CLASS: Record<string, string> = {
  DOCTOR: "bg-[#ecf3ff] text-[#0066ff]",
  SECRETARY: "bg-violet-50 text-violet-700",
  CLINIC_ADMIN: "bg-[#f3f2f1] text-[#1a1b1e]",
};

export function StaffPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const clinicId = useAuthStore((s) => s.clinicId ?? s.tenantId)!;
  const { staff, reload, loading, error } = useClinicAdmin();

  const [form, setForm] = useState<StaffFormState>(emptyStaffForm);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "DOCTOR" | "SECRETARY">("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 250);

  const stats = useMemo(() => {
    const doctors = staff.filter((s) => s.staffRole === "DOCTOR").length;
    const secretaries = staff.filter((s) => s.staffRole === "SECRETARY").length;
    const active = staff.filter((s) => (s.status ?? "ACTIVE") === "ACTIVE").length;
    return { total: staff.length, doctors, secretaries, active };
  }, [staff]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return staff.filter((member) => {
      if (roleFilter !== "ALL" && member.staffRole !== roleFilter) return false;
      if (!q) return true;
      const name = (member.fullName ?? `${member.firstName ?? ""} ${member.lastName ?? ""}`).toLowerCase();
      const phone = (member.phoneNumber ?? "").toLowerCase();
      const spec = (member.specialization ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q) || spec.includes(q) || member.staffRole.toLowerCase().includes(q);
    });
  }, [staff, debouncedSearch, roleFilter]);

  const patchForm = (patch: Partial<StaffFormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.role === "DOCTOR" && !form.specialization.trim()) {
      setMessage("Specialization is required for doctors.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await createClinicStaff(staffFormToPayload(form, clinicId), token);
      const hint = result.whatsappSent
        ? "Credentials sent via WhatsApp."
        : result.whatsappHint ?? "Share credentials manually.";
      setMessage(`${result.message} ${hint}`);
      setForm(emptyStaffForm());
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
    <div className="pbi-canvas space-y-4">
      <PageHeader
        title="Staff management"
        subtitle="Add doctors and secretaries · live directory"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => void reload()}
            disabled={loading}
            className="rounded-sm h-9 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Sync
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile label="Total staff" value={stats.total} icon={Users} />
        <KpiTile label="Doctors" value={stats.doctors} icon={Stethoscope} accent="brand" />
        <KpiTile label="Secretaries" value={stats.secretaries} icon={UserCog} accent="neutral" />
        <KpiTile label="Active" value={stats.active} hint="Can sign in" accent="success" icon={Users} />
      </div>

      {error && <AlertBanner message={error} tone="error" />}
      {message && (
        <AlertBanner message={message} tone={message.includes("Could not") ? "error" : undefined} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 items-start">
        <PanelCard
          title="Add team member"
          subtitle="Role-specific fields · WhatsApp credentials when connected"
        >
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <StaffRoleForm form={form} onChange={patchForm} />
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#0066ff] hover:bg-[#0052cc] rounded-sm h-9 text-xs font-semibold"
            >
              {submitting ? "Creating…" : `Create ${form.role === "DOCTOR" ? "doctor" : "secretary"}`}
            </Button>
          </form>
        </PanelCard>

        <PanelCard
          title="Clinic directory"
          subtitle={`${filtered.length} shown`}
          noPadding
        >
          <div className="p-3 border-b border-[#edebe9] space-y-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, role…"
              className="h-9 rounded-sm text-sm"
            />
            <div className="flex gap-1 p-0.5 bg-[#f3f2f1] rounded-sm w-fit">
              {(["ALL", "DOCTOR", "SECRETARY"] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRoleFilter(role)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors",
                    roleFilter === role
                      ? "bg-white text-[#0066ff] shadow-sm"
                      : "text-[#929296] hover:text-[#1a1b1e]",
                  )}
                >
                  {role === "ALL" ? "All" : role.charAt(0) + role.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <table className="pbi-data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Details</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center text-[#929296] py-10">Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-[#929296] py-10">No staff match</td>
                </tr>
              ) : (
                filtered.map((member) => {
                  const name =
                    member.fullName ?? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
                  return (
                    <tr key={member.userId}>
                      <td>
                        <p className="font-semibold">{name || "—"}</p>
                        <p className="text-[11px] text-[#929296]">{member.phoneNumber ?? "—"}</p>
                      </td>
                      <td>
                        <span className={cn("pbi-status-pill", ROLE_CLASS[member.staffRole] ?? "bg-[#f3f2f1]")}>
                          {member.staffRole}
                        </span>
                      </td>
                      <td className="text-xs text-[#929296] max-w-[140px] truncate">
                        {member.staffRole === "DOCTOR"
                          ? member.specialization ?? "—"
                          : "Front desk"}
                      </td>
                      <td>{member.status ?? "ACTIVE"}</td>
                      <td className="text-right space-x-3">
                        <button
                          type="button"
                          onClick={() => void handleStatusToggle(member.userId, member.status)}
                          className="text-[#0066ff] hover:underline text-xs font-semibold"
                        >
                          {member.status === "SUSPENDED" ? "Activate" : "Suspend"}
                        </button>
                        {member.staffRole !== "CLINIC_ADMIN" && (
                          <button
                            type="button"
                            onClick={() => void handleRemove(member.userId)}
                            className="text-red-600 hover:underline text-xs font-semibold"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </PanelCard>
      </div>
    </div>
  );
}
