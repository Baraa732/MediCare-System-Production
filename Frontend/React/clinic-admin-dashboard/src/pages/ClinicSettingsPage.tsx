import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Clock,
  Globe,
  Mail,
  MapPin,
  Phone,
  Save,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import * as clinicApi from "@/lib/api/clinics";
import { normalizeCaughtError } from "@/lib/api/errors";
import type { ClinicDoctor, ClinicPublic } from "@/lib/api/types";
import { AlertBanner, PageLoading } from "@/components/layout/PageState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PanelCard } from "@/components/layout/PanelCard";
import { ClinicPreviewCard } from "@/features/settings/ClinicPreviewCard";
import { ClinicLogoUpload } from "@/features/settings/ClinicLogoUpload";
import {
  SettingsFieldGroup,
  SettingsSectionNav,
  type SettingsSection,
} from "@/features/settings/SettingsSectionNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TIMEZONES = [
  "Asia/Damascus",
  "Asia/Beirut",
  "Asia/Amman",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Europe/Istanbul",
  "UTC",
];

type ClinicHoursDay = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed?: boolean;
};

function sectionDirty(
  section: SettingsSection,
  form: Partial<ClinicPublic>,
  initial: Partial<ClinicPublic>,
): boolean {
  const keys: Record<SettingsSection, (keyof ClinicPublic)[]> = {
    identity: ["name", "description"],
    location: ["address", "city", "governorate"],
    contact: ["phone", "email"],
    operations: ["timezone"],
  };
  return keys[section].some((key) => (form[key] ?? "") !== (initial[key] ?? ""));
}

export function ClinicSettingsPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const { clinicId: contextClinicId, reload: reloadClinicContext } = useClinicAdmin();
  const authClinicId = useAuthStore((s) => s.clinicId ?? s.tenantId);
  const clinicId = contextClinicId ?? authClinicId;

  const [form, setForm] = useState<Partial<ClinicPublic>>({});
  const [initial, setInitial] = useState<Partial<ClinicPublic>>({});
  const [doctors, setDoctors] = useState<ClinicDoctor[]>([]);
  const [hours, setHours] = useState<ClinicHoursDay[]>([]);
  const [activeSection, setActiveSection] = useState<SettingsSection>("identity");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await clinicApi.getClinicProfile(clinicId, token);
        if (cancelled) return;
        setForm(res.clinic);
        setInitial(res.clinic);
        setDoctors(res.doctors ?? []);
        setHours(res.hours ?? []);
      } catch (err) {
        if (!cancelled) {
          setLoadError(normalizeCaughtError(err, "Failed to load clinic settings"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clinicId, token]);

  const dirtySections = useMemo(() => {
    const set = new Set<SettingsSection>();
    (["identity", "location", "contact", "operations"] as SettingsSection[]).forEach(
      (section) => {
        if (sectionDirty(section, form, initial)) set.add(section);
      },
    );
    return set;
  }, [form, initial]);

  const isDirty = dirtySections.size > 0;

  const patch = (key: keyof ClinicPublic, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setMessage(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!clinicId) return;
    setSaving(true);
    setMessage(null);
    setSaveError(null);
    try {
      const res = await clinicApi.updateClinic(
        clinicId,
        {
          name: form.name,
          address: form.address,
          city: form.city,
          governorate: form.governorate,
          phone: form.phone,
          email: form.email,
          description: form.description,
          timezone: form.timezone,
        },
        token,
      );
      setForm(res.clinic);
      setInitial(res.clinic);
      setMessage("Clinic settings saved successfully.");
    } catch (err) {
      setSaveError(normalizeCaughtError(err, "Could not save settings"));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setForm(initial);
    setMessage(null);
    setSaveError(null);
  };

  if (loading || !clinicId) return <PageLoading label="Loading clinic settings…" />;

  return (
    <div className="pbi-canvas space-y-4">
      <PageHeader
        title="Clinic settings"
        subtitle="Configure identity, location, and operations"
        actions={
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDiscard}
                className="rounded-sm h-9 text-xs"
              >
                Discard
              </Button>
            )}
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !isDirty}
              className="bg-[#0066ff] hover:bg-[#0052cc] rounded-sm h-9 text-xs font-semibold"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      />

      {loadError && <AlertBanner message={loadError} tone="error" />}
      {saveError && <AlertBanner message={saveError} tone="error" />}
      {message && <AlertBanner message={message} />}

      <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_300px] gap-4 items-start">
        <SettingsSectionNav
          active={activeSection}
          onChange={setActiveSection}
          dirtySections={dirtySections}
        />

        <PanelCard
          title={
            activeSection === "identity"
              ? "Clinic identity"
              : activeSection === "location"
                ? "Location"
                : activeSection === "contact"
                  ? "Contact channels"
                  : "Operations"
          }
          subtitle="Changes apply across your clinic workspace"
        >
          {activeSection === "identity" && (
            <SettingsFieldGroup title="Brand" icon={Building2}>
              <ClinicLogoUpload
                clinicId={clinicId}
                token={token}
                logoUrl={form.logoUrl}
                onUploaded={(url) => {
                  setForm((f) => ({ ...f, logoUrl: url }));
                  setInitial((f) => ({ ...f, logoUrl: url }));
                  void reloadClinicContext();
                }}
              />
              <div className="space-y-1.5">
                <Label>Clinic name</Label>
                <Input
                  value={form.name ?? ""}
                  onChange={(e) => patch("name", e.target.value)}
                  placeholder="MediCare Downtown Clinic"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => patch("description", e.target.value)}
                  placeholder="Short description for staff and patients…"
                  className="w-full min-h-[120px] rounded-sm border border-input px-3 py-2 text-sm resize-y"
                />
              </div>
              {form.status && (
                <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 py-2 text-sm">
                  <span className="text-[#929296]">Status: </span>
                  <span className="font-semibold">{form.status}</span>
                  <span className="block text-[11px] text-[#929296] mt-1">
                    Managed by the platform — contact support to change.
                  </span>
                </div>
              )}
            </SettingsFieldGroup>
          )}

          {activeSection === "location" && (
            <SettingsFieldGroup title="Address" icon={MapPin}>
              <div className="space-y-1.5">
                <Label>Street address</Label>
                <Input
                  value={form.address ?? ""}
                  onChange={(e) => patch("address", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input
                    value={form.city ?? ""}
                    onChange={(e) => patch("city", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Governorate</Label>
                  <Input
                    value={form.governorate ?? ""}
                    onChange={(e) => patch("governorate", e.target.value)}
                  />
                </div>
              </div>
            </SettingsFieldGroup>
          )}

          {activeSection === "contact" && (
            <SettingsFieldGroup title="Reach patients & staff" icon={Phone}>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#929296]" /> Clinic phone
                </Label>
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => patch("phone", e.target.value)}
                  placeholder="09xxxxxxxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#929296]" /> Email
                </Label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => patch("email", e.target.value)}
                  placeholder="clinic@example.com"
                />
              </div>
            </SettingsFieldGroup>
          )}

          {activeSection === "operations" && (
            <SettingsFieldGroup title="Scheduling context" icon={Globe}>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#929296]" /> Timezone
                </Label>
                <select
                  value={form.timezone ?? ""}
                  onChange={(e) => patch("timezone", e.target.value)}
                  className="h-9 w-full rounded-sm border border-input px-2.5 text-sm"
                >
                  <option value="">Select timezone</option>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                  {form.timezone && !TIMEZONES.includes(form.timezone) && (
                    <option value={form.timezone}>{form.timezone}</option>
                  )}
                </select>
              </div>
              <p className="text-xs text-[#929296] leading-relaxed">
                Weekly hours are configured on the Schedule page. This timezone is used for
                appointment timestamps across the clinic.
              </p>
            </SettingsFieldGroup>
          )}
        </PanelCard>

        <div className="xl:sticky xl:top-4">
          <ClinicPreviewCard
            clinic={form}
            doctors={doctors}
            hours={hours}
            dirty={isDirty}
          />
        </div>
      </div>
    </div>
  );
}
