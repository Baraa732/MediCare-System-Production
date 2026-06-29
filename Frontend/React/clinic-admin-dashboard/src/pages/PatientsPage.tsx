import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, RefreshCw, UserPlus, Users } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { lookupPatientByPhone } from "@/lib/api/users";
import { normalizeCaughtError } from "@/lib/api/errors";
import { useClinicAdmin } from "@/context/ClinicAdminContext";
import { AlertBanner } from "@/components/layout/PageState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PanelCard } from "@/components/layout/PanelCard";
import { KpiTile } from "@/components/layout/KpiTile";
import { PatientDetailPanel } from "@/features/patients/PatientDetailPanel";
import { PatientList } from "@/features/patients/PatientList";
import { PatientSearchToolbar } from "@/features/patients/PatientSearchToolbar";
import {
  buildPatientRegistry,
  filterPatients,
  sortPatients,
  type PatientRegistryItem,
  type PatientSortKey,
} from "@/features/patients/patientRegistry";
import {
  isPhoneLikeQuery,
  normalizePhoneQuery,
  useDebouncedValue,
} from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";

export function PatientsPage() {
  const token = useAuthStore((s) => s.accessToken)!;
  const { appointments, doctors, loading, error, reload } = useClinicAdmin();

  const [query, setQuery] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("ALL");
  const [visitFilter, setVisitFilter] = useState<"ALL" | "UPCOMING" | "RECENT">("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<PatientSortKey>("lastVisit");
  const [selected, setSelected] = useState<PatientRegistryItem | null>(null);
  const [enriched, setEnriched] = useState<PatientRegistryItem[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [phoneSearching, setPhoneSearching] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 400);

  const baseRegistry = useMemo(
    () => buildPatientRegistry(appointments),
    [appointments],
  );

  const registry = useMemo(() => {
    let list = baseRegistry;
    for (const extra of enriched) {
      if (!list.some((p) => p.patientId === extra.patientId)) {
        list = [extra, ...list];
      }
    }
    return list;
  }, [baseRegistry, enriched]);

  const filtered = useMemo(() => {
    const result = filterPatients(registry, {
      query: debouncedQuery,
      doctorId: doctorFilter,
      visitFilter,
      statusFilter,
    });
    return sortPatients(result, sortKey);
  }, [registry, debouncedQuery, doctorFilter, visitFilter, statusFilter, sortKey]);

  const stats = useMemo(() => {
    const upcoming = registry.filter((p) => p.nextVisit).length;
    const withPhone = registry.filter((p) => p.phoneNumber).length;
    return {
      total: registry.length,
      upcoming,
      identified: withPhone,
    };
  }, [registry]);

  useEffect(() => {
    const phone = normalizePhoneQuery(debouncedQuery);
    if (!isPhoneLikeQuery(debouncedQuery) || phone.length < 8) {
      setPhoneSearching(false);
      return;
    }

    let cancelled = false;
    setPhoneSearching(true);
    setLookupError(null);

    void lookupPatientByPhone(phone, token)
      .then((result) => {
        if (cancelled) return;
        const item: PatientRegistryItem = {
          patientId: result.id,
          phoneNumber: result.phoneNumber,
          firstName: result.firstName,
          lastName: result.lastName,
          fullName: result.fullName,
          status: result.status,
          appointmentCount: 0,
          lastVisit: null,
          nextVisit: null,
          doctorIds: [],
          visitStatuses: [],
          source: "lookup",
        };
        const fromAppts = baseRegistry.find((p) => p.patientId === result.id);
        const merged = fromAppts
          ? { ...fromAppts, ...item, appointmentCount: fromAppts.appointmentCount, doctorIds: fromAppts.doctorIds, visitStatuses: fromAppts.visitStatuses, lastVisit: fromAppts.lastVisit, nextVisit: fromAppts.nextVisit }
          : item;

        setEnriched((prev) => [merged, ...prev.filter((p) => p.patientId !== result.id)]);
        setSelected(merged);
      })
      .catch((err) => {
        if (!cancelled) {
          setLookupError(normalizeCaughtError(err, "No patient found for this phone"));
        }
      })
      .finally(() => {
        if (!cancelled) setPhoneSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, token, baseRegistry]);

  const isLiveFiltering = query !== debouncedQuery || phoneSearching;

  return (
    <div className="pbi-canvas space-y-4">
      <PageHeader
        title="Patients"
        subtitle="Real-time search across clinic visits and patient registry"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => void reload()}
            disabled={loading}
            className="rounded-sm h-9 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiTile label="Known patients" value={stats.total} hint="Last 30 days" icon={Users} />
        <KpiTile
          label="With upcoming"
          value={stats.upcoming}
          hint="Scheduled visits"
          icon={CalendarCheck}
          accent="success"
        />
        <KpiTile
          label="Identified"
          value={stats.identified}
          hint="Phone on file"
          icon={UserPlus}
          accent="neutral"
        />
      </div>

      <PatientSearchToolbar
        query={query}
        onQueryChange={setQuery}
        doctorFilter={doctorFilter}
        onDoctorFilterChange={setDoctorFilter}
        visitFilter={visitFilter}
        onVisitFilterChange={setVisitFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortKey={sortKey}
        onSortChange={setSortKey}
        doctors={doctors}
        resultCount={filtered.length}
        isSearching={isLiveFiltering}
      />

      {error && <AlertBanner message={error} tone="error" />}
      {lookupError && debouncedQuery.length >= 8 && (
        <AlertBanner message={lookupError} tone="error" />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <PanelCard
          title="Patient directory"
          subtitle="Updates as you type · phone lookup from 8 digits"
          noPadding
        >
          <PatientList
            patients={filtered}
            selectedId={selected?.patientId ?? null}
            loading={loading}
            searching={phoneSearching}
            onSelect={setSelected}
          />
        </PanelCard>

        <div className="xl:sticky xl:top-4">
          <PatientDetailPanel
            patient={selected}
            appointments={appointments}
            doctors={doctors}
            onClose={() => setSelected(null)}
          />
        </div>
      </div>
    </div>
  );
}
