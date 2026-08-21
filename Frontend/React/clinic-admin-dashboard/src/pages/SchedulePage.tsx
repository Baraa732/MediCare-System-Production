import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfToday } from "date-fns";
import { CalendarDays, DoorClosed, Stethoscope, Timer } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import * as scheduleApi from "@/lib/api/schedule";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { normalizeCaughtError } from "@/lib/api/errors";
import { AlertBanner } from "@/components/layout/PageState";
import { PageHeader } from "@/components/layout/PageHeader";
import { ClinicHoursBoard } from "@/features/schedule/ClinicHoursBoard";
import { DayCoverageTimeline } from "@/features/schedule/DayCoverageTimeline";
import { ScheduleDatePicker } from "@/features/schedule/ScheduleDatePicker";
import { ScheduleOpsForms } from "@/features/schedule/ScheduleOpsForms";
import {
  DAY_NAMES,
  combineDateAndTime,
  coverageMinutesForDay,
  hoursEqual,
  openDaysCount,
  uniqueDoctorsCovered,
} from "@/features/schedule/scheduleUtils";
import { cn } from "@/lib/utils";

const DEFAULT_HOURS: scheduleApi.ClinicHoursDay[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openTime: "09:00",
  closeTime: "17:00",
  isClosed: dayOfWeek === 5 || dayOfWeek === 6,
}));

function ensureWeek(hours: scheduleApi.ClinicHoursDay[]): scheduleApi.ClinicHoursDay[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const found = hours.find((h) => h.dayOfWeek === dayOfWeek);
    return (
      found ?? {
        dayOfWeek,
        openTime: "09:00",
        closeTime: "17:00",
        isClosed: dayOfWeek === 5 || dayOfWeek === 6,
      }
    );
  });
}

export function SchedulePage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const clinicId = useAuthStore((s) => s.clinicId ?? s.tenantId)!;
  const { doctors } = useClinicAdmin();

  const [selectedDate, setSelectedDate] = useState(() => startOfToday());
  const [hours, setHours] = useState<scheduleApi.ClinicHoursDay[]>(DEFAULT_HOURS);
  const [savedHours, setSavedHours] = useState<scheduleApi.ClinicHoursDay[]>(DEFAULT_HOURS);
  const [availability, setAvailability] = useState<scheduleApi.AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");

  const [availForm, setAvailForm] = useState({
    doctorId: "",
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
  const dirty = !hoursEqual(hours, savedHours);

  const activeWeekdays = useMemo(
    () => new Set(availability.map((s) => s.dayOfWeek)),
    [availability],
  );

  const closedWeekdays = useMemo(
    () => new Set(hours.filter((h) => h.isClosed).map((h) => h.dayOfWeek)),
    [hours],
  );

  const dayHours = useMemo(
    () => hours.find((h) => h.dayOfWeek === selectedDayOfWeek),
    [hours, selectedDayOfWeek],
  );

  const dayAvailability = useMemo(
    () =>
      availability
        .filter((s) => s.dayOfWeek === selectedDayOfWeek)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [availability, selectedDayOfWeek],
  );

  const doctorOptions = useMemo(
    () =>
      doctors.map((d) => ({
        userId: d.userId,
        label: d.fullName ?? d.firstName ?? d.userId.slice(0, 8),
      })),
    [doctors],
  );

  const doctorName = (id: string) =>
    doctorOptions.find((d) => d.userId === id)?.label ?? id.slice(0, 8);

  const kpis = useMemo(() => {
    const open = openDaysCount(hours);
    const covered = uniqueDoctorsCovered(availability);
    const dayMins = coverageMinutesForDay(availability, selectedDayOfWeek);
    const closed = hours.filter((h) => h.isClosed).length;
    return [
      {
        label: "Open days / week",
        value: String(open),
        hint: `${closed} closed`,
        icon: CalendarDays,
        accent: "bg-[#0066ff]",
      },
      {
        label: "Doctors covered",
        value: String(covered),
        hint: `${doctors.length} on staff`,
        icon: Stethoscope,
        accent: "bg-[#0f766e]",
      },
      {
        label: "Coverage today",
        value: dayHours?.isClosed ? "—" : `${Math.round(dayMins / 60)}h`,
        hint: DAY_NAMES[selectedDayOfWeek],
        icon: Timer,
        accent: "bg-[#b45309]",
      },
      {
        label: "Selected day",
        value: dayHours?.isClosed ? "Closed" : "Open",
        hint: dayHours?.isClosed
          ? "No booking"
          : `${dayHours?.openTime ?? "—"}–${dayHours?.closeTime ?? "—"}`,
        icon: DoorClosed,
        accent: dayHours?.isClosed ? "bg-[#929296]" : "bg-[#0066ff]",
      },
    ];
  }, [hours, availability, selectedDayOfWeek, dayHours, doctors.length]);

  const flash = (text: string, tone: "info" | "error" = "info") => {
    setMessage(text);
    setMessageTone(tone);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [hoursRes, availRes] = await Promise.all([
        scheduleApi.getClinicHours(clinicId, token),
        scheduleApi.listAvailability(clinicId, token),
      ]);
      const loaded = ensureWeek(hoursRes.hours?.length ? hoursRes.hours : DEFAULT_HOURS);
      setHours(loaded);
      setSavedHours(loaded);
      setAvailability(availRes.availability ?? []);
      if (doctors[0]) {
        setAvailForm((f) => ({ ...f, doctorId: f.doctorId || doctors[0].userId }));
      }
    } catch (err) {
      flash(normalizeCaughtError(err, "Failed to load schedule"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, token, doctors.length]);

  useEffect(() => {
    if (dayHours?.isClosed) return;
    setBlockForm((f) => ({
      ...f,
      startTime: dayHours?.openTime ?? f.startTime,
      endTime: dayHours?.closeTime ?? f.endTime,
    }));
  }, [dayHours?.openTime, dayHours?.closeTime, dayHours?.isClosed, selectedDayOfWeek]);

  const selectDayOfWeek = (dayOfWeek: number) => {
    const diff = dayOfWeek - selectedDate.getDay();
    setSelectedDate(addDays(selectedDate, diff));
  };

  const updateHour = (dayOfWeek: number, patch: Partial<scheduleApi.ClinicHoursDay>) => {
    setHours((prev) =>
      ensureWeek(
        prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h)),
      ),
    );
  };

  const saveHours = async () => {
    setSaving(true);
    try {
      const res = await scheduleApi.setClinicHoursBatch(clinicId, hours, token);
      const next = ensureWeek(res.hours?.length ? res.hours : hours);
      setHours(next);
      setSavedHours(next);
      flash("Clinic operating hours saved.");
    } catch (err) {
      flash(normalizeCaughtError(err, "Could not save clinic hours"), "error");
    } finally {
      setSaving(false);
    }
  };

  const addAvailability = async () => {
    if (!availForm.doctorId) {
      flash("Select a doctor for the coverage slot.", "error");
      return;
    }
    try {
      await scheduleApi.createAvailability(
        {
          clinicId,
          doctorId: availForm.doctorId,
          dayOfWeek: selectedDayOfWeek,
          startTime: availForm.startTime,
          endTime: availForm.endTime,
        },
        token,
      );
      await load();
      flash(`Coverage added for ${DAY_NAMES[selectedDayOfWeek]}s.`);
    } catch (err) {
      flash(normalizeCaughtError(err, "Could not add availability"), "error");
    }
  };

  const addBlock = async () => {
    if (!blockForm.startTime || !blockForm.endTime) {
      flash("Block start and end times are required.", "error");
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
      flash(`Time block created for ${format(selectedDate, "MMM d, yyyy")}.`);
    } catch (err) {
      flash(normalizeCaughtError(err, "Could not create block"), "error");
    }
  };

  return (
    <div className="pbi-canvas space-y-4 pb-8">
      <PageHeader
        title="Schedule"
        subtitle="Set clinic hours, doctor coverage, and time blocks — your clinic’s operating blueprint"
        actions={
          dirty ? (
            <button
              type="button"
              onClick={() => void saveHours()}
              disabled={saving}
              className="h-8 px-3 rounded-sm text-xs font-semibold bg-[#0066ff] text-white hover:bg-[#0052cc]"
            >
              {saving ? "Saving…" : "Save hours"}
            </button>
          ) : null
        }
      />

      {message && <AlertBanner message={message} tone={messageTone} />}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="pbi-kpi-tile">
              <div className={cn("pbi-kpi-accent", kpi.accent)} />
              <div className="pbi-kpi-body flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="pbi-kpi-label">{kpi.label}</p>
                  <p className="pbi-kpi-value text-[24px]">{kpi.value}</p>
                  <p className="pbi-kpi-hint truncate">{kpi.hint}</p>
                </div>
                <div className="pbi-kpi-icon-wrap">
                  <Icon className="w-4 h-4 text-[#0066ff]" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ClinicHoursBoard
        hours={hours}
        selectedDayOfWeek={selectedDayOfWeek}
        dirty={dirty}
        saving={saving}
        onSelectDay={selectDayOfWeek}
        onChange={updateHour}
        onSave={() => void saveHours()}
        onReset={() => setHours(savedHours)}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
        <div className="xl:sticky xl:top-4 space-y-3">
          <ScheduleDatePicker
            selected={selectedDate}
            onSelect={setSelectedDate}
            activeWeekdays={activeWeekdays}
            closedWeekdays={closedWeekdays}
          />

          <div className="pbi-panel p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#929296]">
              Day snapshot
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-[#929296]">Clinic</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    dayHours?.isClosed ? "text-red-600" : "text-[#1a1b1e]",
                  )}
                >
                  {dayHours?.isClosed
                    ? "Closed"
                    : `${dayHours?.openTime ?? "—"} – ${dayHours?.closeTime ?? "—"}`}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-[#929296]">Doctor slots</span>
                <span className="font-semibold tabular-nums">{dayAvailability.length}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-[#929296]">Providers</span>
                <span className="font-semibold tabular-nums">
                  {new Set(dayAvailability.map((s) => s.doctorId)).size}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-[#929296] leading-relaxed border-t border-[#f3f2f1] pt-3">
              Tip: set hours first, then add doctor coverage for each open weekday.
            </p>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <DayCoverageTimeline
            dayLabel={format(selectedDate, "EEEE, MMMM d")}
            dayHours={dayHours}
            slots={dayAvailability}
            doctorName={doctorName}
            loading={loading}
          />

          <ScheduleOpsForms
            selectedDayOfWeek={selectedDayOfWeek}
            selectedDateLabel={format(selectedDate, "MMM d, yyyy")}
            doctors={doctorOptions}
            availForm={availForm}
            blockForm={blockForm}
            onAvailChange={(patch) => setAvailForm((f) => ({ ...f, ...patch }))}
            onBlockChange={(patch) => setBlockForm((f) => ({ ...f, ...patch }))}
            onAddAvailability={() => void addAvailability()}
            onAddBlock={() => void addBlock()}
          />

          <section className="pbi-panel">
            <header className="pbi-panel-header">
              <div className="min-w-0">
                <h2 className="pbi-panel-title">All recurring coverage</h2>
                <p className="pbi-panel-subtitle">Every doctor slot across the week</p>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="pbi-data-table min-w-[480px]">
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Weekday</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {availability.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-[#929296] py-10">
                        No recurring coverage yet — add slots above.
                      </td>
                    </tr>
                  ) : (
                    [...availability]
                      .sort(
                        (a, b) =>
                          a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
                      )
                      .map((slot) => (
                        <tr key={slot.id}>
                          <td className="font-medium">{doctorName(slot.doctorId)}</td>
                          <td>
                            <button
                              type="button"
                              className="hover:text-[#0066ff] font-medium"
                              onClick={() => selectDayOfWeek(slot.dayOfWeek)}
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
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
