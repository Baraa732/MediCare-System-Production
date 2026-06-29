import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfToday } from "date-fns";
import { CalendarClock, Clock, Stethoscope, Store } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import * as scheduleApi from "@/lib/api/schedule";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { normalizeCaughtError } from "@/lib/api/errors";
import { AlertBanner } from "@/components/layout/PageState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PanelCard } from "@/components/layout/PanelCard";
import { ScheduleDatePicker } from "@/features/schedule/ScheduleDatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_HOURS: scheduleApi.ClinicHoursDay[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openTime: "09:00",
  closeTime: "17:00",
  isClosed: dayOfWeek === 5 || dayOfWeek === 6,
}));

function combineDateAndTime(date: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}

export function SchedulePage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const clinicId = useAuthStore((s) => s.clinicId ?? s.tenantId)!;
  const { doctors } = useClinicAdmin();

  const [selectedDate, setSelectedDate] = useState(() => startOfToday());
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
    startTime: "09:00",
    endTime: "17:00",
    reason: "",
  });

  const selectedDayOfWeek = selectedDate.getDay();

  const activeWeekdays = useMemo(
    () => new Set(availability.map((s) => s.dayOfWeek)),
    [availability],
  );

  const dayHours = useMemo(
    () => hours.find((h) => h.dayOfWeek === selectedDayOfWeek),
    [hours, selectedDayOfWeek],
  );

  const dayAvailability = useMemo(
    () => availability.filter((s) => s.dayOfWeek === selectedDayOfWeek),
    [availability, selectedDayOfWeek],
  );

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

  useEffect(() => {
    setAvailForm((f) => ({ ...f, dayOfWeek: selectedDayOfWeek }));
  }, [selectedDayOfWeek]);

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
    if (!blockForm.startTime || !blockForm.endTime) {
      setMessage("Block start and end times are required.");
      return;
    }
    try {
      await scheduleApi.createScheduleBlock(
        {
          clinicId,
          doctorId: blockForm.doctorId || undefined,
          startsAt: combineDateAndTime(selectedDate, blockForm.startTime),
          endsAt: combineDateAndTime(selectedDate, blockForm.endTime),
          reason: blockForm.reason || undefined,
        },
        token,
      );
      setBlockForm({ doctorId: "", startTime: "09:00", endTime: "17:00", reason: "" });
      setMessage(`Block created for ${format(selectedDate, "MMM d, yyyy")}.`);
    } catch (err) {
      setMessage(normalizeCaughtError(err, "Could not create block"));
    }
  };

  const clinicOpenLabel = dayHours?.isClosed
    ? "Closed"
    : `${dayHours?.openTime ?? "—"} – ${dayHours?.closeTime ?? "—"}`;

  return (
    <div className="pbi-canvas space-y-4">
      <PageHeader
        title="Schedule"
        subtitle="Plan clinic hours, doctor availability, and blocked days"
        actions={
          <Button
            onClick={() => void saveHours()}
            disabled={saving || loading}
            className="bg-[#0066ff] hover:bg-[#0052cc] rounded-sm h-8 text-xs font-semibold"
          >
            {saving ? "Saving…" : "Save weekly hours"}
          </Button>
        }
      />

      {message && <AlertBanner message={message} />}

      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
        <div className="xl:sticky xl:top-4 space-y-3">
          <ScheduleDatePicker
            selected={selectedDate}
            onSelect={setSelectedDate}
            activeWeekdays={activeWeekdays}
          />

          <div className="pbi-panel p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#929296]">
              {format(selectedDate, "EEEE")}
            </p>
            <div className="flex items-start gap-2.5">
              <div className="pbi-kpi-icon-wrap">
                <Store className="w-4 h-4 text-[#0066ff]" />
              </div>
              <div>
                <p className="text-xs text-[#929296]">Clinic hours</p>
                <p className={cn("text-sm font-semibold", dayHours?.isClosed && "text-red-600")}>
                  {clinicOpenLabel}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="pbi-kpi-icon-wrap">
                <Stethoscope className="w-4 h-4 text-[#0066ff]" />
              </div>
              <div>
                <p className="text-xs text-[#929296]">Doctors available</p>
                <p className="text-sm font-semibold">{dayAvailability.length}</p>
              </div>
            </div>
            <p className="text-[10px] text-[#929296] leading-relaxed">
              Blue dots on the calendar mark weekdays with configured doctor slots.
            </p>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <PanelCard
            title={format(selectedDate, "EEEE, MMMM d")}
            subtitle="Availability and operations for the selected day"
          >
            {loading ? (
              <p className="text-sm text-[#929296]">Loading schedule…</p>
            ) : dayHours?.isClosed ? (
              <div className="flex items-center gap-3 py-6 text-sm text-[#929296]">
                <CalendarClock className="w-5 h-5 shrink-0" />
                Clinic is closed on {DAY_NAMES[selectedDayOfWeek]}.
              </div>
            ) : dayAvailability.length === 0 ? (
              <div className="flex items-center gap-3 py-6 text-sm text-[#929296]">
                <Clock className="w-5 h-5 shrink-0" />
                No doctor slots for this weekday yet — add one below.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {dayAvailability.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between gap-3 rounded-sm border border-[#edebe9] bg-[#faf9f8] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{doctorName(slot.doctorId)}</p>
                      <p className="text-xs text-[#929296]">Doctor slot</p>
                    </div>
                    <p className="text-sm font-medium tabular-nums shrink-0">
                      {slot.startTime} – {slot.endTime}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>

          <PanelCard title="Weekly clinic hours" subtitle="Applies to every week">
            <div className="overflow-x-auto">
              <table className="pbi-data-table min-w-[520px]">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Status</th>
                    <th>Open</th>
                    <th>Close</th>
                  </tr>
                </thead>
                <tbody>
                  {hours.map((h) => {
                    const isSelected = h.dayOfWeek === selectedDayOfWeek;
                    return (
                      <tr
                        key={h.dayOfWeek}
                        className={cn(isSelected && "bg-[#ecf3ff]/40")}
                      >
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              const diff = h.dayOfWeek - selectedDate.getDay();
                              setSelectedDate(addDays(selectedDate, diff));
                            }}
                            className={cn(
                              "text-left font-medium hover:text-[#0066ff] transition-colors",
                              isSelected && "text-[#0066ff]",
                            )}
                          >
                            {DAY_NAMES[h.dayOfWeek]}
                          </button>
                        </td>
                        <td>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!h.isClosed}
                              onChange={(e) => updateHour(h.dayOfWeek, { isClosed: e.target.checked })}
                            />
                            {h.isClosed ? "Closed" : "Open"}
                          </label>
                        </td>
                        <td>
                          <Input
                            type="time"
                            value={h.openTime}
                            disabled={h.isClosed}
                            onChange={(e) => updateHour(h.dayOfWeek, { openTime: e.target.value })}
                            className="h-8 w-[120px]"
                          />
                        </td>
                        <td>
                          <Input
                            type="time"
                            value={h.closeTime}
                            disabled={h.isClosed}
                            onChange={(e) => updateHour(h.dayOfWeek, { closeTime: e.target.value })}
                            className="h-8 w-[120px]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PanelCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PanelCard
              title="Add doctor slot"
              subtitle={`For ${DAY_NAMES[selectedDayOfWeek]}s`}
            >
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Doctor</Label>
                  <select
                    value={availForm.doctorId}
                    onChange={(e) => setAvailForm((f) => ({ ...f, doctorId: e.target.value }))}
                    className="h-8 w-full rounded-sm border border-input px-2.5 text-sm"
                  >
                    <option value="">Select</option>
                    {doctors.map((d) => (
                      <option key={d.userId} value={d.userId}>
                        {doctorName(d.userId)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Start</Label>
                    <Input
                      type="time"
                      value={availForm.startTime}
                      onChange={(e) => setAvailForm((f) => ({ ...f, startTime: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End</Label>
                    <Input
                      type="time"
                      value={availForm.endTime}
                      onChange={(e) => setAvailForm((f) => ({ ...f, endTime: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => void addAvailability()}
                  className="w-full bg-[#0066ff] hover:bg-[#0052cc] rounded-sm h-9 text-xs font-semibold"
                >
                  Add recurring slot
                </Button>
              </div>
            </PanelCard>

            <PanelCard
              title="Block time"
              subtitle={`On ${format(selectedDate, "MMM d, yyyy")}`}
            >
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Doctor (optional)</Label>
                  <select
                    value={blockForm.doctorId}
                    onChange={(e) => setBlockForm((f) => ({ ...f, doctorId: e.target.value }))}
                    className="h-8 w-full rounded-sm border border-input px-2.5 text-sm"
                  >
                    <option value="">Whole clinic</option>
                    {doctors.map((d) => (
                      <option key={d.userId} value={d.userId}>
                        {doctorName(d.userId)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Input
                    value={blockForm.reason}
                    onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="Holiday, maintenance…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>From</Label>
                    <Input
                      type="time"
                      value={blockForm.startTime}
                      onChange={(e) => setBlockForm((f) => ({ ...f, startTime: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Until</Label>
                    <Input
                      type="time"
                      value={blockForm.endTime}
                      onChange={(e) => setBlockForm((f) => ({ ...f, endTime: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => void addBlock()}
                  variant="outline"
                  className="w-full rounded-sm h-9 text-xs"
                >
                  Create block
                </Button>
              </div>
            </PanelCard>
          </div>

          <PanelCard title="All recurring slots" noPadding>
            <table className="pbi-data-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Day</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {availability.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-[#929296] py-10">
                      No availability slots configured
                    </td>
                  </tr>
                ) : (
                  availability.map((slot) => (
                    <tr key={slot.id}>
                      <td>{doctorName(slot.doctorId)}</td>
                      <td>
                        <button
                          type="button"
                          className="hover:text-[#0066ff] font-medium"
                          onClick={() => {
                            const diff = slot.dayOfWeek - selectedDate.getDay();
                            setSelectedDate(addDays(selectedDate, diff));
                          }}
                        >
                          {DAY_NAMES[slot.dayOfWeek]}
                        </button>
                      </td>
                      <td className="tabular-nums">
                        {slot.startTime} – {slot.endTime}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
