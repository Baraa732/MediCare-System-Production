import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, startOfToday } from "date-fns";
import { Ban, CalendarCheck, CalendarOff, Plus } from "lucide-react";
import { toast, Toaster } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import * as scheduleApi from "@/lib/api/schedule";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { normalizeCaughtError } from "@/lib/api/errors";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { AddCoverageDialog } from "@/features/schedule/AddCoverageDialog";
import { BlockTimeDialog } from "@/features/schedule/BlockTimeDialog";
import { LeaveRequestsPanel } from "@/features/schedule/LeaveRequestsPanel";
import { ScheduleCalendar } from "@/features/schedule/ScheduleCalendar";
import { WeeklyHoursStrip } from "@/features/schedule/WeeklyHoursStrip";
import {
  DAY_NAMES,
  combineDateAndTime,
  ensureWeekHours,
  hoursEqual,
} from "@/features/schedule/scheduleUtils";

const DEFAULT_HOURS = ensureWeekHours([]);

function toastCancelled(count: number | undefined) {
  if (count && count > 0) {
    toast.message(
      `${count} appointment${count === 1 ? "" : "s"} cancelled — patients notified`,
    );
  }
}

export function SchedulePage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const clinicId = useAuthStore((s) => s.clinicId ?? s.tenantId)!;
  const { doctors, appointments, reload: reloadClinic } = useClinicAdmin();

  const [selectedDate, setSelectedDate] = useState(() => startOfToday());
  const [hours, setHours] = useState<scheduleApi.ClinicHoursDay[]>(DEFAULT_HOURS);
  const [savedHours, setSavedHours] = useState<scheduleApi.ClinicHoursDay[]>(DEFAULT_HOURS);
  const [availability, setAvailability] = useState<scheduleApi.AvailabilitySlot[]>([]);
  const [blocks, setBlocks] = useState<scheduleApi.ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closingDay, setClosingDay] = useState(false);
  const [openingDay, setOpeningDay] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const dirty = !hoursEqual(hours, savedHours);
  const selectedDayOfWeek = selectedDate.getDay();
  const dayHours = hours.find((h) => h.dayOfWeek === selectedDayOfWeek);

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const selectedDayFullyBlocked = useMemo(() => {
    const dayStart = new Date(`${selectedDateKey}T00:00:00`);
    const dayEnd = new Date(`${selectedDateKey}T23:59:59.999`);
    return blocks.some((b) => {
      if (b.doctorId) return false;
      if (b.status && b.status !== "APPROVED") return false;
      const start = new Date(b.startsAt).getTime();
      const end = new Date(b.endsAt).getTime();
      return start <= dayStart.getTime() + 60_000 && end >= dayEnd.getTime() - 60_000;
    });
  }, [blocks, selectedDateKey]);

  const selectedDayClosed =
    Boolean(dayHours?.isClosed) || selectedDayFullyBlocked;

  const doctorOptions = useMemo(
    () =>
      doctors.map((d) => ({
        userId: d.userId,
        label:
          d.fullName ??
          d.firstName ??
          (d.userId?.trim() ? d.userId.slice(0, 8) : "Doctor"),
      })),
    [doctors],
  );

  const activeBlocks = useMemo(
    () => blocks.filter((b) => !b.status || b.status === "APPROVED"),
    [blocks],
  );

  const doctorName = useCallback(
    (id: string) =>
      doctorOptions.find((d) => d.userId === id)?.label ??
      (id?.trim() ? id.slice(0, 8) : "Doctor"),
    [doctorOptions],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [hoursRes, availRes, blocksRes] = await Promise.all([
        scheduleApi.getClinicHours(clinicId, token),
        scheduleApi.listAvailability(clinicId, token),
        scheduleApi.listScheduleBlocks(clinicId, token),
      ]);
      const loaded = ensureWeekHours(hoursRes.hours?.length ? hoursRes.hours : DEFAULT_HOURS);
      setHours(loaded);
      setSavedHours(loaded);
      setAvailability(availRes.availability ?? []);
      setBlocks(blocksRes.blocks ?? []);
    } catch (err) {
      toast.error(normalizeCaughtError(err, "Failed to load schedule"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, token, doctors.length]);

  const selectDayOfWeek = (dayOfWeek: number) => {
    const diff = dayOfWeek - selectedDate.getDay();
    setSelectedDate(addDays(selectedDate, diff));
  };

  const updateHour = (dayOfWeek: number, patch: Partial<scheduleApi.ClinicHoursDay>) => {
    setHours((prev) =>
      ensureWeekHours(prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h))),
    );
  };

  const saveHours = async () => {
    setSaving(true);
    try {
      const res = await scheduleApi.setClinicHoursBatch(clinicId, hours, token);
      const next = ensureWeekHours(res.hours?.length ? res.hours : hours);
      setHours(next);
      setSavedHours(next);
      toast.success("Clinic hours saved");
      toastCancelled(res.cancelledCount);
      await load();
      void reloadClinic();
    } catch (err) {
      toast.error(normalizeCaughtError(err, "Could not save clinic hours"));
    } finally {
      setSaving(false);
    }
  };

  const addCoverage = async (values: {
    doctorId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) => {
    try {
      await scheduleApi.createAvailability({ clinicId, ...values }, token);
      await load();
      toast.success(`Coverage added for ${DAY_NAMES[values.dayOfWeek]}s`);
    } catch (err) {
      toast.error(normalizeCaughtError(err, "Could not add coverage"));
      throw err;
    }
  };

  const addBlock = async (values: {
    doctorId: string;
    startTime: string;
    endTime: string;
    reason: string;
  }) => {
    try {
      const res = await scheduleApi.createScheduleBlock(
        {
          clinicId,
          doctorId: values.doctorId || undefined,
          startsAt: combineDateAndTime(selectedDate, values.startTime),
          endsAt: combineDateAndTime(selectedDate, values.endTime),
          reason: values.reason || undefined,
        },
        token,
      );
      toast.success(`Block created for ${format(selectedDate, "MMM d")}`);
      toastCancelled(res.cancelledCount);
      await load();
      void reloadClinic();
    } catch (err) {
      toast.error(normalizeCaughtError(err, "Could not create block"));
      throw err;
    }
  };

  const reviewLeave = async (id: string, decision: "approve" | "reject") => {
    setReviewingId(id);
    try {
      const res =
        decision === "approve"
          ? await scheduleApi.approveLeaveRequest(id, token)
          : await scheduleApi.rejectLeaveRequest(id, token);
      toast.success(
        decision === "approve"
          ? "Leave approved — doctor is unavailable for that period"
          : "Leave request rejected",
      );
      toastCancelled(res.cancelledCount);
      await load();
      void reloadClinic();
    } catch (err) {
      toast.error(
        normalizeCaughtError(
          err,
          decision === "approve"
            ? "Could not approve leave"
            : "Could not reject leave",
        ),
      );
    } finally {
      setReviewingId(null);
    }
  };

  const closeDay = async () => {
    const label = format(selectedDate, "EEEE, MMM d yyyy");
    const confirmed = window.confirm(
      `Close the clinic for ${label}?\n\n` +
        `• No new appointments can be booked that day\n` +
        `• Existing REQUESTED/CONFIRMED appointments that day will be cancelled\n` +
        `• Patients will be notified\n\n` +
        `Continue?`,
    );
    if (!confirmed) return;

    setClosingDay(true);
    try {
      const res = await scheduleApi.closeClinicDay(
        clinicId,
        {
          date: format(selectedDate, "yyyy-MM-dd"),
          reason: "Clinic closed for the day",
        },
        token,
      );
      toast.success(`Clinic closed on ${format(selectedDate, "MMM d")}`);
      toastCancelled(res.cancelledCount);
      await load();
      void reloadClinic();
    } catch (err) {
      toast.error(normalizeCaughtError(err, "Could not close clinic day"));
    } finally {
      setClosingDay(false);
    }
  };

  const openDay = async () => {
    const label = format(selectedDate, "EEEE, MMM d yyyy");
    const confirmed = window.confirm(
      `Re-open the clinic for ${label}?\n\n` +
        `• Removes the full-day closure block\n` +
        `• Secretaries and patients can book again (if the weekday is open in weekly hours)\n\n` +
        `Continue?`,
    );
    if (!confirmed) return;

    setOpeningDay(true);
    try {
      const res = await scheduleApi.openClinicDay(
        clinicId,
        { date: format(selectedDate, "yyyy-MM-dd") },
        token,
      );
      if (res.removed > 0) {
        toast.success(`Clinic re-opened on ${format(selectedDate, "MMM d")}`);
      } else {
        toast.message(
          "No full-day closure found. If this weekday is closed, toggle it open in weekly hours and Save.",
        );
      }
      await load();
      void reloadClinic();
    } catch (err) {
      toast.error(normalizeCaughtError(err, "Could not open clinic day"));
    } finally {
      setOpeningDay(false);
    }
  };

  return (
    <div className="pbi-canvas space-y-4 pb-8">
      <Toaster position="top-right" richColors closeButton />
      <PageHeader
        title="Schedule"
        subtitle="Clinic hours and doctor coverage — calendar-first operations"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedDayFullyBlocked ? (
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-sm text-xs"
                disabled={openingDay}
                onClick={() => void openDay()}
              >
                <CalendarCheck className="w-3.5 h-3.5 mr-1.5" />
                {openingDay ? "Opening…" : "Open day"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-sm text-xs"
                disabled={closingDay || selectedDayClosed}
                onClick={() => void closeDay()}
                title={
                  dayHours?.isClosed
                    ? "This weekday is closed in weekly hours — toggle it open there"
                    : undefined
                }
              >
                <CalendarOff className="w-3.5 h-3.5 mr-1.5" />
                {closingDay ? "Closing…" : "Close day"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-sm text-xs"
              onClick={() => setBlockOpen(true)}
            >
              <Ban className="w-3.5 h-3.5 mr-1.5" />
              Block time
            </Button>
            <Button
              type="button"
              className="h-8 rounded-sm text-xs bg-[#0066ff] hover:bg-[#0052cc]"
              onClick={() => setCoverageOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add coverage
            </Button>
            {dirty && (
              <Button
                type="button"
                disabled={saving}
                onClick={() => void saveHours()}
                className="h-8 rounded-sm text-xs bg-[#0066ff] hover:bg-[#0052cc]"
              >
                {saving ? "Saving…" : "Save hours"}
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="pbi-panel p-10 flex items-center justify-center gap-3 text-sm text-[#929296]">
          <div className="pbi-spinner" />
          Loading schedule…
        </div>
      ) : (
        <>
          <WeeklyHoursStrip
            hours={hours}
            selectedDayOfWeek={selectedDayOfWeek}
            dirty={dirty}
            onSelectDay={selectDayOfWeek}
            onChange={updateHour}
          />

          <ScheduleCalendar
            hours={hours}
            availability={availability}
            blocks={activeBlocks}
            appointments={appointments}
            doctorName={doctorName}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onDatesSet={() => undefined}
            onSelectSlotDay={setSelectedDate}
          />

          <LeaveRequestsPanel
            blocks={blocks}
            doctorName={doctorName}
            reviewingId={reviewingId}
            onApprove={(id) => void reviewLeave(id, "approve")}
            onReject={(id) => void reviewLeave(id, "reject")}
          />

          <section className="pbi-panel">
            <header className="pbi-panel-header">
              <div className="min-w-0">
                <h2 className="pbi-panel-title">All recurring coverage</h2>
                <p className="pbi-panel-subtitle">Click a weekday to focus the calendar</p>
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
                        No coverage yet — use Add coverage.
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
        </>
      )}

      <AddCoverageDialog
        open={coverageOpen}
        onOpenChange={setCoverageOpen}
        doctors={doctorOptions}
        defaultDayOfWeek={selectedDayOfWeek}
        defaultStart={dayHours?.isClosed ? "09:00" : (dayHours?.openTime ?? "09:00")}
        defaultEnd={dayHours?.isClosed ? "12:00" : (dayHours?.closeTime ?? "12:00")}
        onSubmit={addCoverage}
      />

      <BlockTimeDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        doctors={doctorOptions}
        date={selectedDate}
        defaultStart={dayHours?.isClosed ? "09:00" : (dayHours?.openTime ?? "09:00")}
        defaultEnd={dayHours?.isClosed ? "17:00" : (dayHours?.closeTime ?? "17:00")}
        onSubmit={addBlock}
      />
    </div>
  );
}
