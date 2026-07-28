import { useMemo, useState } from "react";
import { LayoutGrid, List, Plus, RefreshCw, Stethoscope, UserCog, Users } from "lucide-react";
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
import { TenantScopeBadge } from "@/components/layout/TenantScopeBadge";
import {
  StaffRoleForm,
  emptyStaffForm,
  staffFormToPayload,
  type StaffFormState,
} from "@/features/staff/StaffRoleForm";
import { StaffMemberCard } from "@/features/staff/StaffMemberCard";
import { StaffDetailPanel } from "@/features/staff/StaffDetailPanel";
import { roleLabel, staffDisplayName } from "@/features/staff/staffUtils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StaffMember } from "@/lib/api/types";

type ViewMode = "cards" | "table";
type RoleFilter = "ALL" | "DOCTOR" | "SECRETARY" | "CLINIC_ADMIN";
type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED";

export function StaffPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const { clinic, staff, doctors, appointments, reload, loading, error, clinicId: contextClinicId } =
    useClinicAdmin();
  const authClinicId = useAuthStore((s) => s.clinicId ?? s.tenantId);
  const clinicId = contextClinicId ?? authClinicId;

  const [form, setForm] = useState<StaffFormState>(emptyStaffForm);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 250);

  const stats = useMemo(() => {
    const doctorsCount = staff.filter((s) => s.staffRole === "DOCTOR").length;
    const secretaries = staff.filter((s) => s.staffRole === "SECRETARY").length;
    const active = staff.filter((s) => (s.status ?? "ACTIVE") === "ACTIVE").length;
    const suspended = staff.filter((s) => s.status === "SUSPENDED").length;
    return { total: staff.length, doctorsCount, secretaries, active, suspended };
  }, [staff]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return staff.filter((member) => {
      if (roleFilter !== "ALL" && member.staffRole !== roleFilter) return false;
      if (statusFilter !== "ALL" && (member.status ?? "ACTIVE") !== statusFilter) return false;
      if (!q) return true;
      const name = staffDisplayName(member).toLowerCase();
      const phone = (member.phoneNumber ?? "").toLowerCase();
      const spec = (member.specialization ?? "").toLowerCase();
      const dept = (member.department ?? "").toLowerCase();
      return (
        name.includes(q) ||
        phone.includes(q) ||
        spec.includes(q) ||
        dept.includes(q) ||
        member.staffRole.toLowerCase().includes(q)
      );
    });
  }, [staff, debouncedSearch, roleFilter, statusFilter]);

  const selected = useMemo(
    () => staff.find((s) => s.userId === selectedId) ?? null,
    [staff, selectedId],
  );

  const patchForm = (patch: Partial<StaffFormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) {
      setMessage("Clinic workspace is not loaded yet.");
      return;
    }
    if (form.role === "DOCTOR" && !form.specialization.trim()) {
      setMessage("Specialization is required for doctors.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await createClinicStaff(staffFormToPayload(form, clinicId), token);
      const devPwd =
        result.devTemporaryPassword != null
          ? ` Temporary password (dev): ${result.devTemporaryPassword}`
          : "";
      const hint = result.whatsappSent
        ? "Credentials sent via WhatsApp."
        : result.whatsappHint ?? "Share credentials manually if WhatsApp is unavailable.";
      setMessage(`${result.message} ${hint}${devPwd}`);
      setForm(emptyStaffForm());
      setShowCreate(false);
      await reload();
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not create staff member"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!clinicId) return;
    if (!confirm("Remove this staff member from your clinic? They will lose access to this tenant.")) return;
    try {
      await clinicApi.removeStaff(clinicId, userId, token);
      if (selectedId === userId) setSelectedId(null);
      await reload();
      setMessage("Staff member removed from clinic.");
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not remove staff member"));
    }
  };

  const handleStatusToggle = async (userId: string, current?: string) => {
    const next = current === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await userApi.updateUserStatus(userId, next, token);
      await reload();
      setMessage(`Access ${next === "ACTIVE" ? "restored" : "suspended"}.`);
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not update user status"));
    }
  };

  return (
    <div className="pbi-canvas space-y-4">
      <PageHeader
        title="Workforce"
        subtitle={`${clinic?.name ?? "Your clinic"} · doctors & secretaries assigned to this tenant only`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TenantScopeBadge clinicName={clinic?.name} />
            <Button
              type="button"
              size="sm"
              onClick={() => setShowCreate((v) => !v)}
              className="bg-[#0066ff] hover:bg-[#0052cc] text-white rounded-sm h-9 px-4 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add staff
            </Button>
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
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile label="Total staff" value={stats.total} icon={Users} />
        <KpiTile label="Doctors" value={stats.doctorsCount} icon={Stethoscope} accent="brand" />
        <KpiTile label="Secretaries" value={stats.secretaries} icon={UserCog} accent="neutral" />
        <KpiTile label="Active" value={stats.active} hint="Can sign in" accent="success" icon={Users} />
        <KpiTile label="Suspended" value={stats.suspended} hint="Access paused" accent="warning" icon={Users} />
      </div>

      {error && <AlertBanner message={error} tone="error" />}
      {message && (
        <AlertBanner message={message} tone={message.toLowerCase().includes("could not") ? "error" : undefined} />
      )}

      {showCreate && (
        <PanelCard
          title="Onboard team member"
          subtitle="Identity, credentials, and desk profile · WhatsApp activation when connected"
        >
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <StaffRoleForm form={form} onChange={patchForm} />
            <div className="flex gap-2 pt-2 border-t border-[#edebe9]">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#0066ff] hover:bg-[#0052cc] rounded-sm h-9 text-xs font-semibold"
              >
                {submitting ? "Creating…" : `Create ${form.role === "DOCTOR" ? "doctor" : "secretary"}`}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="rounded-sm h-9 text-xs">
                Cancel
              </Button>
            </div>
          </form>
        </PanelCard>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 items-start">
        <PanelCard
          title="Clinic directory"
          subtitle={`${filtered.length} of ${staff.length} · ${doctors.length} on scheduling roster`}
          noPadding
          actions={
            <div className="flex gap-1 p-0.5 bg-[#f3f2f1] rounded-sm">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "p-1.5 rounded-sm",
                  viewMode === "cards" ? "bg-white shadow-sm text-[#0066ff]" : "text-[#929296]",
                )}
                title="Card view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "p-1.5 rounded-sm",
                  viewMode === "table" ? "bg-white shadow-sm text-[#0066ff]" : "text-[#929296]",
                )}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          }
        >
          <div className="p-3 border-b border-[#edebe9] space-y-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, specialization, department…"
              className="h-9 rounded-sm text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 p-0.5 bg-[#f3f2f1] rounded-sm">
                {(["ALL", "DOCTOR", "SECRETARY", "CLINIC_ADMIN"] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRoleFilter(role)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors",
                      roleFilter === role ? "bg-white text-[#0066ff] shadow-sm" : "text-[#929296]",
                    )}
                  >
                    {role === "ALL" ? "All roles" : roleLabel(role)}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 p-0.5 bg-[#f3f2f1] rounded-sm">
                {(["ALL", "ACTIVE", "SUSPENDED"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors",
                      statusFilter === status ? "bg-white text-[#0066ff] shadow-sm" : "text-[#929296]",
                    )}
                  >
                    {status === "ALL" ? "All status" : status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-[#929296] py-12 text-sm">Loading workforce…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[#929296] py-12 text-sm">No staff match your filters</p>
          ) : viewMode === "cards" ? (
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((member) => (
                <StaffMemberCard
                  key={member.userId}
                  member={member}
                  appointments={appointments}
                  selected={selectedId === member.userId}
                  onSelect={() => setSelectedId(member.userId)}
                />
              ))}
            </div>
          ) : (
            <StaffTable
              rows={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onSuspend={handleStatusToggle}
              onRemove={handleRemove}
            />
          )}
        </PanelCard>

        <StaffDetailPanel
          member={selected}
          appointments={appointments}
          onSuspend={handleStatusToggle}
          onRemove={handleRemove}
        />
      </div>
    </div>
  );
}

function StaffTable({
  rows,
  selectedId,
  onSelect,
  onSuspend,
  onRemove,
}: {
  rows: StaffMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSuspend: (userId: string, status?: string) => void;
  onRemove: (userId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="pbi-data-table min-w-[720px]">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Contact</th>
            <th>Profile</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((member) => (
            <tr
              key={member.userId}
              className={cn(selectedId === member.userId && "bg-[#ecf3ff]/40")}
              onClick={() => onSelect(member.userId)}
            >
              <td>
                <p className="font-semibold">{staffDisplayName(member)}</p>
                <p className="text-[11px] text-[#929296]">{member.phoneNumber ?? "—"}</p>
              </td>
              <td>{roleLabel(member.staffRole)}</td>
              <td className="text-xs text-[#929296]">{member.email ?? "—"}</td>
              <td className="text-xs text-[#929296] max-w-[160px] truncate">
                {member.staffRole === "DOCTOR"
                  ? member.specialization ?? "—"
                  : member.department ?? member.username ?? "—"}
              </td>
              <td>{member.status ?? "ACTIVE"}</td>
              <td className="text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onSuspend(member.userId, member.status)}
                  className="text-[#0066ff] hover:underline text-xs font-semibold"
                >
                  {member.status === "SUSPENDED" ? "Activate" : "Suspend"}
                </button>
                {member.staffRole !== "CLINIC_ADMIN" && (
                  <button
                    type="button"
                    onClick={() => onRemove(member.userId)}
                    className="text-red-600 hover:underline text-xs font-semibold"
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
