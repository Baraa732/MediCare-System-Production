import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Search, Stethoscope, UserRound, X } from "lucide-react";
import { addDays, subDays } from "date-fns";
import { formatClinicDateTime } from "@/lib/time/clinicTime";
import { listAppointments } from "@/lib/api/appointments";
import { useAuthStore } from "@/stores/authStore";
import { useScheduleContext } from "../../context/ScheduleContext";
import { useScheduleGridStore } from "../../hooks/scheduleGridStore";
import { useHandleDatePicker } from "../../hooks/useHandleDatePicker";
import { useAppointmentDrawer } from "../../hooks/useAppointmentDrawer";
import { usePendingRequest } from "../../hooks/usePendingRequest";
import { useWizardDrawer } from "../../hooks/useWizardDrawer";
import type { ApiAppointment } from "@/lib/api/types";
import {
  AdvancedFilterPanel,
  AdvancedFilterTrigger,
} from "./AdvancedFilterPanel";
import { clinicNowGridMinutes } from "../../utils/editModeDrag";
import { appointmentMatchesFilters } from "../../utils/scheduleFilters";

type ResultKind = "patient" | "doctor" | "appointment" | "request";

interface SearchHit {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle: string;
  date?: Date;
  appointmentId?: string;
  requestId?: string;
}

function hay(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/**
 * Search + advanced filters live together in the header.
 * Text-text filters the dashboard live; Filters panel adds structured rules.
 * No full-screen blur overlay — dropdown stays under the control.
 */
export function SearchBar() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchQuery = useScheduleGridStore((s) => s.searchQuery);
  const setSearchQuery = useScheduleGridStore((s) => s.setSearchQuery);
  const filters = useScheduleGridStore((s) => s.filters);
  const filterPanelOpen = useScheduleGridStore((s) => s.filterPanelOpen);
  const setFilterPanelOpen = useScheduleGridStore((s) => s.setFilterPanelOpen);
  const { doctors, clinicId, selectedDate } = useScheduleContext();
  const accessToken = useAuthStore((s) => s.accessToken);
  const changeDate = useHandleDatePicker((s) => s.handleChangeDate);
  const openAppointment = useAppointmentDrawer((s) => s.open);
  const requests = usePendingRequest((s) => s.requests);
  const openPending = useWizardDrawer((s) => s.openWithPendingRequest);
  const isWizardOpen = useWizardDrawer((s) => s.isWizardOpen);
  const appointmentId = useAppointmentDrawer((s) => s.appointmentId);
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(false);

  const q = searchQuery.trim().toLowerCase();
  const nowGrid = clinicNowGridMinutes(selectedDate);

  useEffect(() => {
    if (isWizardOpen || appointmentId) {
      setOpen(false);
      setFilterPanelOpen(false);
    }
  }, [isWizardOpen, appointmentId, setFilterPanelOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setFilterPanelOpen(false);
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && e.shiftKey) {
        e.preventDefault();
        setOpen(false);
        setFilterPanelOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setFilterPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setFilterPanelOpen]);

  useEffect(() => {
    if (!open && !filterPanelOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilterPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, filterPanelOpen, setFilterPanelOpen]);

  useEffect(() => {
    if (!open || q.length < 2 || !accessToken || !clinicId) {
      setRemote([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const from = subDays(selectedDate, 7);
    const to = addDays(selectedDate, 21);
    const timer = window.setTimeout(() => {
      void listAppointments(
        {
          clinicId,
          from: from.toISOString(),
          to: to.toISOString(),
        },
        accessToken,
      )
        .then((res) => {
          if (!cancelled) setRemote(res.appointments ?? []);
        })
        .catch(() => {
          if (!cancelled) setRemote([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accessToken, clinicId, open, q, selectedDate]);

  const results = useMemo<SearchHit[]>(() => {
    if (!q && filters.statuses.length === 0 && filters.doctorIds.length === 0) {
      return [];
    }

    const hits: SearchHit[] = [];
    const ctx = { nowGridMinutes: nowGrid, selectedDate };

    for (const doc of doctors) {
      if (
        q &&
        hay(doc.name, doc.specialty).includes(q) &&
        (filters.doctorIds.length === 0 || filters.doctorIds.includes(doc.id))
      ) {
        hits.push({
          id: `doc-${doc.id}`,
          kind: "doctor",
          title: doc.name,
          subtitle: `${doc.specialty ?? "Doctor"} · ${doc.appointments.length} on this day`,
        });
      }

      for (const apt of doc.appointments) {
        if (!appointmentMatchesFilters(apt, doc, filters, ctx)) continue;
        if (
          !q ||
          hay(
            apt.title,
            apt.notes,
            apt.patient?.name,
            apt.patient?.phone,
            apt.status,
          ).includes(q)
        ) {
          // already filtered by appointmentMatchesFilters for query; still push
        }
        hits.push({
          id: `apt-${apt.id}`,
          kind: "appointment",
          title: apt.patient?.name || apt.title || "Appointment",
          subtitle: `${doc.name} · ${apt.status} · ${apt.patient?.phone || "no phone"}`,
          date: selectedDate,
          appointmentId: apt.id,
        });
      }
    }

    for (const req of requests) {
      if (
        !hay(req.patient?.name, req.patient?.phone, req.title, req.notes).includes(
          q || "",
        ) &&
        q
      ) {
        continue;
      }
      if (filters.doctorIds.length && !filters.doctorIds.includes(req.docId)) {
        continue;
      }
      if (
        filters.statuses.length &&
        !filters.statuses.includes("pending_request")
      ) {
        continue;
      }
      hits.push({
        id: `req-${req.id}`,
        kind: "request",
        title: req.patient?.name || req.title || "Pending request",
        subtitle: req.patient?.phone || "Needs review",
        requestId: req.id,
      });
    }

    for (const apt of remote) {
      const patient =
        apt.guestPatientName ||
        apt.reason ||
        (apt.patientId ? `Patient ${apt.patientId.slice(0, 8)}` : "Guest");
      if (
        !hay(
          patient,
          apt.guestPatientPhone,
          apt.reason,
          apt.notes,
          apt.status,
          apt.patientId,
        ).includes(q)
      ) {
        continue;
      }
      if (hits.some((hit) => hit.appointmentId === apt.id)) continue;
      if (filters.doctorIds.length && !filters.doctorIds.includes(apt.doctorId)) {
        continue;
      }
      const doctorName =
        doctors.find((d) => d.id === apt.doctorId)?.name ?? "Doctor";
      hits.push({
        id: `remote-${apt.id}`,
        kind: "appointment",
        title: patient,
        subtitle: `${doctorName} · ${apt.status} · ${formatClinicDateTime(apt.scheduledAt)}`,
        date: new Date(apt.scheduledAt),
        appointmentId: apt.id,
      });
    }

    return hits.slice(0, 24);
  }, [doctors, q, remote, requests, selectedDate, filters, nowGrid]);

  const applyHit = (hit: SearchHit) => {
    setOpen(false);
    setFilterPanelOpen(false);
    if (hit.kind === "doctor") {
      setSearchQuery(hit.title);
    }
    if (hit.date) changeDate(hit.date);
    if (hit.appointmentId) openAppointment(hit.appointmentId);
    if (hit.requestId) {
      const request = requests.find((item) => item.id === hit.requestId);
      if (request) openPending(request);
    }
  };

  return (
    <div ref={rootRef} className="relative z-40 flex w-full max-w-140 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          value={searchQuery}
          onFocus={() => {
            setFilterPanelOpen(false);
            setOpen(true);
          }}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setFilterPanelOpen(false);
            setOpen(true);
          }}
          placeholder="Search patients, doctors, phones, notes…"
          className="relative z-10 h-9.5 w-full rounded-xl border border-neutral-200/80 bg-white pl-10 pr-16 text-xs font-medium placeholder-neutral-400 shadow-sm transition-all duration-200 focus:border-[#0066ff] focus:outline-hidden focus:shadow-md"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400 sm:inline">
          ⌘K
        </kbd>
        {searchQuery ? (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-12 top-1/2 z-10 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 sm:right-14"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {open && !filterPanelOpen ? (
          <div
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-xl"
            role="listbox"
            aria-label="Search results"
          >
            <div className="border-b border-neutral-100 px-4 py-2 text-[11px] font-medium text-neutral-500">
              Live dashboard filter · open Filters for status, time, doctor…
              {loading ? " · searching clinic…" : ""}
            </div>
            {q.length < 1 ? (
              <p className="px-4 py-6 text-center text-xs text-neutral-400">
                Type to filter the schedule, or press{" "}
                <span className="font-semibold text-neutral-600">Filters</span>{" "}
                for advanced rules (⇧⌘F).
              </p>
            ) : results.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-neutral-400">
                No jump targets — the grid still reflects your live filter.
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1">
                {results.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => applyHit(hit)}
                      className="interactive-row flex w-full items-start gap-3 px-4 py-2.5 text-left"
                    >
                      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-50 text-neutral-500">
                        {hit.kind === "doctor" ? (
                          <Stethoscope className="h-4 w-4" />
                        ) : hit.kind === "request" ? (
                          <CalendarClock className="h-4 w-4" />
                        ) : (
                          <UserRound className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-neutral-900">
                          {hit.title}
                        </span>
                        <span className="block truncate text-[11px] text-neutral-500">
                          {hit.kind} · {hit.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <AdvancedFilterTrigger />
      <AdvancedFilterPanel />
    </div>
  );
}
