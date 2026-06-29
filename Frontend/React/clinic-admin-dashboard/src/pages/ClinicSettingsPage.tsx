import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import * as clinicApi from "@/lib/api/clinics";
import { normalizeCaughtError } from "@/lib/api/errors";
import type { ClinicPublic } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClinicSettingsPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const clinicId = useAuthStore((s) => s.clinicId ?? s.tenantId)!;
  const [form, setForm] = useState<Partial<ClinicPublic>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await clinicApi.getClinic(clinicId, token);
        if (!cancelled) setForm(res.clinic);
      } catch (err) {
        if (!cancelled) setMessage(normalizeCaughtError(err, "Failed to load clinic"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clinicId, token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
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
      setMessage("Clinic settings saved.");
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not save settings"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-neutral-500">Loading clinic settings…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Clinic settings</h1>
        <p className="text-neutral-500 mt-1">Update your clinic profile and contact information</p>
      </div>

      {message && <p className="text-sm text-[#0066ff] bg-[#ecf3ff] px-4 py-2 rounded-xl">{message}</p>}

      <Card className="ring-neutral-200">
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            {[
              ["name", "Clinic name"],
              ["address", "Address"],
              ["city", "City"],
              ["governorate", "Governorate"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["timezone", "Timezone"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input
                  value={(form as Record<string, string>)[key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full min-h-[100px] rounded-lg border border-input px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" disabled={saving} className="bg-[#0066ff] hover:bg-[#0052cc] rounded-xl h-11">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
