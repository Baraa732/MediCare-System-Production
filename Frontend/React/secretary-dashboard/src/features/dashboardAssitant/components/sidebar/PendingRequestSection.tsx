import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { useEditeMode } from "../../hooks/useEditeMode";
import type { DoctorType, PendingRequest } from "../../types";
import { useWizardDrawer } from "../../hooks/useWizardDrawer";
import { usePendingRequest } from "../../hooks/usePendingRequest";
import { useScheduleGridStore } from "../../hooks/scheduleGridStore";
import { useScheduleContext } from "../../context/ScheduleContext";
import { formatClinicDate, formatClinicTime } from "@/lib/time/clinicTime";
import { useAuthStore } from "@/stores/authStore";
import {
  cancelAppointment,
  updateAppointmentStatus,
} from "@/lib/api/appointments";
import { isApiAppointmentId } from "../../hooks/useAppointmentActions";
import { normalizeCaughtError } from "@/lib/api/errors";
import { emitStaffRealtime } from "@/lib/realtimeEvents";
import { pendingRequestMatchesFilters } from "../../utils/scheduleFilters";

export function PendingRequestSection() {
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const requests = usePendingRequest((state) => state.requests);
  const filters = useScheduleGridStore((s) => s.filters);
  const { doctors } = useScheduleContext();

  const visibleRequests = requests.filter((item) =>
    pendingRequestMatchesFilters(item, doctors as DoctorType[], filters),
  );

  if (requests.length == 0) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-5">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Pending requests
          </h4>
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full border border-red-100 bg-red-50 px-1 text-[10px] font-extrabold text-red-500">
            {visibleRequests.length}
            {visibleRequests.length !== requests.length
              ? `/${requests.length}`
              : ""}
          </span>
        </div>
      </div>

      <div className="scrollbar-thin scrollbar-thumb-neutral-200 flex-1 space-y-3 overflow-y-auto pr-1">
        {visibleRequests.map((item) => (
          <PendingRequestCard
            key={item.id}
            item={item}
            isEditMode={isEditMode}
            doctorName={doctors.find((doc) => doc.id == item.docId)?.name}
          />
        ))}
      </div>
    </div>
  );
}

interface PendingRequestCardProps {
  item: PendingRequest;
  isEditMode: boolean;
  doctorName?: string;
}

function formatAppointmentDay(value?: Date | string | null): string {
  if (!value) return "";
  return formatClinicDate(value);
}

function formatAppointmentTime(item: PendingRequest): string {
  if (item.scheduledAt) return formatClinicTime(item.scheduledAt);
  if (item.date) return formatClinicTime(item.date);
  return "";
}

function formatTimeAgo(minutesAgo: number): string {
  if (minutesAgo <= 0) return "now";
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  return `${Math.floor(hoursAgo / 24)}d ago`;
}

function PendingRequestCard({
  item,
  isEditMode,
  doctorName,
}: PendingRequestCardProps) {
  const openWithPendingRequest = useWizardDrawer(
    (state) => state.openWithPendingRequest,
  );
  const onRemovePendingRequest = usePendingRequest(
    (s) => s.onRemovePendingRequest,
  );
  const accessToken = useAuthStore((s) => s.accessToken);
  const { softRefetch, applyAppointmentLocally } = useScheduleContext();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!accessToken || !isApiAppointmentId(item.id)) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await updateAppointmentStatus(
        item.id,
        { status: "CONFIRMED" },
        accessToken,
      );
      onRemovePendingRequest(item.id);
      if (res.appointment) {
        applyAppointmentLocally(res.appointment);
        emitStaffRealtime({
          source: "local-mutation",
          action: "upsert",
          appointmentId: res.appointment.id,
          appointment: res.appointment,
        });
      }
      void softRefetch();
    } catch (err) {
      setActionError(
        normalizeCaughtError(err, "Could not confirm this request."),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!accessToken || !isApiAppointmentId(item.id)) return;
    setBusy(true);
    setActionError(null);
    try {
      await cancelAppointment(item.id, accessToken, "Declined by secretary");
      onRemovePendingRequest(item.id);
      emitStaffRealtime({
        source: "local-mutation",
        action: "remove",
        appointmentId: item.id,
      });
      void softRefetch();
    } catch (err) {
      setActionError(
        normalizeCaughtError(err, "Could not decline this request."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`surface-card surface-card-hover relative flex min-h-[110px] overflow-hidden text-right transition-all duration-300 ${
        isEditMode
          ? "border-neutral-300"
          : "border-neutral-200 hover:border-blue-200/80"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between p-3 transition-all duration-350">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h5 className="truncate text-xs font-bold text-neutral-900">
              {item.patient?.name ?? item.title ?? "Patient"}
            </h5>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-neutral-400">
              <Calendar className="h-3 w-3 shrink-0 text-neutral-400" />
              {doctorName}
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-blue-100 bg-blue-50/70 px-1.5 py-0.5 text-[10px] font-bold text-[#0066ff]">
            {formatTimeAgo(item.timeRequistAgo)}
          </span>
        </div>

        <div className="mt-2 flex flex-col justify-between text-[11px] font-semibold text-neutral-500">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-neutral-400" />
            {formatAppointmentDay(item.date)}
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3 text-neutral-400" />
            {formatAppointmentTime(item)}
          </div>
        </div>

        <div className="mt-3 overflow-hidden opacity-100 transition-all duration-300">
          {actionError ? (
            <p className="mb-1 text-[10px] leading-tight text-red-500">
              {actionError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              className="h-8 flex-1 rounded-lg bg-[#16a34a] text-xs font-bold text-white shadow-2xs hover:bg-[#15803d]"
              disabled={busy}
              onClick={() => void handleConfirm()}
            >
              Confirm
            </Button>
            <Button
              variant="outline"
              className="h-8 flex-1 rounded-lg border-red-200 text-xs font-bold text-red-600 hover:bg-red-50"
              disabled={busy}
              onClick={() => void handleDecline()}
            >
              Decline
            </Button>
          </div>
          <Button
            variant="ghost"
            className="mt-1 h-7 w-full text-[11px] font-semibold text-neutral-500"
            disabled={busy}
            onClick={() => openWithPendingRequest(item)}
          >
            Review / reassign
          </Button>
        </div>
      </div>
    </div>
  );
}
