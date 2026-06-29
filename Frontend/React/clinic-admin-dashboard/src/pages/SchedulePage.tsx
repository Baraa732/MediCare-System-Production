import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import * as scheduleApi from "@/lib/api/schedule";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { normalizeCaughtError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_HOURS: scheduleApi.ClinicHoursDay[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openTime: "09:00",
  closeTime: "17:00",
  isClosed: dayOfWeek === 5 || dayOfWeek === 6,
}));

export function SchedulePage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const clinicId = useAuthStore((s) => s.clinicId ?? s.tenantId)!;
  const { doctors } = useClinicAdmin();
  const [hours, setHours] = useState<scheduleApi.ClinicHoursDay[]>(DEFAULT_HOURS);
  const [availability, setAvailability] = useState<scheduleApi.AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [availForm, setAvailForm] = useState({
    doctorId: "",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "12:00",
  });

  const [blockForm, setBlockForm] = useState({
    doctorId: "",
    startsAt: "",
    endsAt: "",
    reason: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [hoursRes, availRes] = await Promise.all([
        scheduleApi.getClinicHours(clinicId, token),
        scheduleApi.listAvailability(clinicId, token),
      ]);
      const loaded = hoursRes.hours ?? [];
      setHours(loaded.length ? loaded : DEFAULT_HOURS);
      setAvailability(availRes.availability ?? []);
      if (doctors[0]) {
        setAvailForm((f) => ({ ...f, doctorId: f.doctorId || doctors[0].userId }));
      }
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Failed to load schedule"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [clinicId, token, doctors.length]);

  const doctorName = (id: string) => {
    const d = doctors.find((x) => x.userId === id);
    return d?.fullName ?? d?.firstName ?? id.slice(0, 8);
  };

  const updateHour = (dayOfWeek: number, patch: Partial<scheduleApi.ClinicHoursDay>) => {
    setHours((prev) => {
      const next = [...prev];
      const idx = next.findIndex((h) => h.dayOfWeek === dayOfWeek);
      if (idx >= 0) next[idx] = { ...next[idx], ...patch };
      else next.push({ dayOfWeek, openTime: "09:00", closeTime: "17:00", ...patch });
      return next.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    });
  };

  const saveHours = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await scheduleApi.setClinicHoursBatch(clinicId, hours, token);
      setHours(res.hours ?? hours);
      setMessage("Clinic hours saved.");
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not save clinic hours"));
    } finally {
      setSaving(false);
    }
  };

  const addAvailability = async () => {
    if (!availForm.doctorId) {
      setMessage("Select a doctor.");
      return;
    }
    try {
      await scheduleApi.createAvailability({ clinicId, ...availForm }, token);
      await load();
      setMessage("Doctor availability added.");
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not add availability"));
    }
  };

  const addBlock = async () => {
    if (!blockForm.startsAt || !blockForm.endsAt) {
      setMessage("Block start and end are required.");
      return;
    }
    try {
      await scheduleApi.createScheduleBlock(
        {
          clinicId,
          doctorId: blockForm.doctorId || undefined,
          startsAt: new Date(blockForm.startsAt).toISOString(),
          endsAt: new Date(blockForm.endsAt).toISOString(),
          reason: blockForm.reason || undefined,
        },
        token,
      );
      setBlockForm({ doctorId: "", startsAt: "", endsAt: "", reason: "" });
      setMessage("Schedule block created.");
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not create block"));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Schedule</h1>
        <p className="text-neutral-500 mt-1">Clinic hours, doctor availability, and blocked time</p>
      </div>

      {message && <p className="text-sm text-[#0066ff] bg-[#ecf3ff] px-4 py-2 rounded-xl">{message}</p>}

      <Card className="ring-neutral-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Clinic hours</CardTitle>
          <Button onClick={() => void saveHours()} disabled={saving} className="bg-[#0066ff] hover:bg-[#0052cc] rounded-xl">
            {saving ? "Saving…" : "Save hours"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-neutral-500">Loading…</p>
          ) : (
            hours.map((h) => (
              <div key={h.dayOfWeek} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center border border-neutral-100 rounded-xl p-3">
                <span className="font-semibold text-sm">{DAY_NAMES[h.dayOfWeek]}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!h.isClosed} onChange={(e) => updateHour(h.dayOfWeek, { isClosed: e.target.checked })} />
                  Closed
                </label>
                <Input type="time" value={h.openTime} disabled={h.isClosed} onChange={(e) => updateHour(h.dayOfWeek, { openTime: e.target.value })} />
                <Input type="time" value={h.closeTime} disabled={h.isClosed} onChange={(e) => updateHour(h.dayOfWeek, { closeTime: e.target.value })} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="ring-neutral-200">
        <CardHeader><CardTitle>Add doctor availability</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Doctor</Label>
            <select value={availForm.doctorId} onChange={(e) => setAvailForm((f) => ({ ...f, doctorId: e.target.value }))} className="h-8 w-full rounded-lg border border-input px-2.5 text-sm">
              <option value="">Select</option>
              {doctors.map((d) => <option key={d.userId} value={d.userId}>{doctorName(d.userId)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Day</Label>
            <select value={availForm.dayOfWeek} onChange={(e) => setAvailForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))} className="h-8 w-full rounded-lg border border-input px-2.5 text-sm">
              {DAY_NAMES.map((name, i) => <option key={name} value={i}>{name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Start</Label><Input type="time" value={availForm.startTime} onChange={(e) => setAvailForm((f) => ({ ...f, startTime: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>End</Label><Input type="time" value={availForm.endTime} onChange={(e) => setAvailForm((f) => ({ ...f, endTime: e.target.value }))} /></div>
          <div className="md:col-span-2">
            <Button onClick={() => void addAvailability()} className="bg-[#0066ff] hover:bg-[#0052cc] rounded-xl">Add slot</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="ring-neutral-200">
        <CardHeader><CardTitle>Block time (holiday / closure)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Doctor (optional — leave empty for whole clinic)</Label>
            <select value={blockForm.doctorId} onChange={(e) => setBlockForm((f) => ({ ...f, doctorId: e.target.value }))} className="h-8 w-full rounded-lg border border-input px-2.5 text-sm">
              <option value="">All clinic</option>
              {doctors.map((d) => <option key={d.userId} value={d.userId}>{doctorName(d.userId)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label>Reason</Label><Input value={blockForm.reason} onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Starts</Label><Input type="datetime-local" value={blockForm.startsAt} onChange={(e) => setBlockForm((f) => ({ ...f, startsAt: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Ends</Label><Input type="datetime-local" value={blockForm.endsAt} onChange={(e) => setBlockForm((f) => ({ ...f, endsAt: e.target.value }))} /></div>
          <div className="md:col-span-2">
            <Button onClick={() => void addBlock()} variant="outline" className="rounded-xl">Create block</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="ring-neutral-200 overflow-hidden">
        <CardHeader><CardTitle>Doctor availability slots</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">Doctor</th>
                <th className="px-4 py-3 text-left">Day</th>
                <th className="px-4 py-3 text-left">Hours</th>
              </tr>
            </thead>
            <tbody>
              {availability.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-neutral-500">No availability slots</td></tr>
              ) : (
                availability.map((slot) => (
                  <tr key={slot.id} className="border-t border-neutral-100">
                    <td className="px-4 py-3">{doctorName(slot.doctorId)}</td>
                    <td className="px-4 py-3">{DAY_NAMES[slot.dayOfWeek]}</td>
                    <td className="px-4 py-3">{slot.startTime} – {slot.endTime}</td>
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
