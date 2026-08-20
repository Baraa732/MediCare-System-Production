import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const searchQuery = useScheduleGridStore((s) => s.searchQuery);
  const setSearchQuery = useScheduleGridStore((s) => s.setSearchQuery);
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
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const q = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (isWizardOpen || appointmentId) setOpen(false);
  }, [isWizardOpen, appointmentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPanelStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        zIndex: 60,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

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
    if (!q) return [];

    const hits: SearchHit[] = [];

    for (const doc of doctors) {
      if (hay(doc.name, doc.specialty).includes(q)) {
        hits.push({
          id: `doc-${doc.id}`,
          kind: "doctor",
          title: doc.name,
          subtitle: `${doc.specialty ?? "Doctor"} · ${doc.appointments.length} on this day`,
        });
      }

      for (const apt of doc.appointments) {
        if (
          hay(apt.title, apt.patient?.name, apt.patient?.phone, apt.status).includes(q)
        ) {
          hits.push({
            id: `apt-${apt.id}`,
            kind: "appointment",
            title: apt.patient?.name || apt.title,
            subtitle: `${doc.name} · ${apt.status} · ${apt.patient?.phone || "no phone"}`,
            date: selectedDate,
            appointmentId: apt.id,
          });
        }
      }
    }

    for (const req of requests) {
      if (hay(req.patient?.name, req.patient?.phone, req.title).includes(q)) {
        hits.push({
          id: `req-${req.id}`,
          kind: "request",
          title: req.patient?.name || req.title || "Pending request",
          subtitle: req.patient?.phone || "Needs review",
          requestId: req.id,
        });
      }
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
          apt.status,
          apt.patientId,
        ).includes(q)
      ) {
        continue;
      }
      if (hits.some((hit) => hit.appointmentId === apt.id)) continue;
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

    return hits.slice(0, 20);
  }, [doctors, q, remote, requests, selectedDate]);

  const applyHit = (hit: SearchHit) => {
    setOpen(false);
    setSearchQuery("");
    if (hit.date) changeDate(hit.date);
    if (hit.appointmentId) openAppointment(hit.appointmentId);
    if (hit.requestId) {
      const request = requests.find((item) => item.id === hit.requestId);
      if (request) openPending(request);
    }
    if (hit.kind === "doctor") {
      setSearchQuery(hit.title);
    }
  };

  const portal =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              className="overlay-backdrop fixed inset-0 z-[55] cursor-default"
              onClick={() => setOpen(false)}
              aria-label="Close search"
            />
            <div
              style={panelStyle}
              className="command-palette overflow-hidden rounded-2xl border border-neutral-100/80 bg-white/95 shadow-2xl backdrop-blur-md"
            >
              <div className="border-b border-neutral-100 px-4 py-2 text-[11px] font-medium text-neutral-500">
                Find a patient, doctor, phone number, or upcoming booking
                {loading ? " · searching clinic…" : ""}
              </div>
              {q.length < 2 ? (
                <p className="px-4 py-8 text-center text-xs text-neutral-400">
                  Type at least 2 characters. Use this to jump to a booking or
                  pending request.
                </p>
              ) : results.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-neutral-400">
                  No matches on this day or the next 3 weeks.
                </p>
              ) : (
                <ul className="stagger-list max-h-80 overflow-y-auto py-1">
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
          </>,
          document.body,
        )
      : null;

  return (
    <div ref={anchorRef} className="relative w-full max-w-105">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
      <input
        ref={inputRef}
        type="search"
        value={searchQuery}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="Search patients, doctors, phone, bookings"
        className="h-9.5 w-full rounded-xl border border-neutral-200/80 bg-white/70 pl-10 pr-16 text-xs font-medium placeholder-neutral-400 shadow-sm backdrop-blur-sm transition-all duration-200 focus:border-[#0066ff] focus:bg-white focus:outline-hidden focus:shadow-md"
      />
      <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400 sm:inline">
        ⌘K
      </kbd>
      {searchQuery ? (
        <button
          type="button"
          onClick={() => {
            setSearchQuery("");
            setOpen(false);
          }}
          className="absolute right-12 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 sm:right-14"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {portal}
    </div>
  );
}
