import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { useEditeMode } from "../../hooks/useEditeMode";
import type { PendingRequest } from "../../types";
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

export function PendingRequestSection() {
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const requests = usePendingRequest((state) => state.requests);
  const searchQuery = useScheduleGridStore((s) => s.searchQuery);
  const { doctors } = useScheduleContext();

  const q = searchQuery.trim().toLowerCase();
  const visibleRequests = q
    ? requests.filter((item) => {
        const hay = [
          item.patient?.name,
          item.patient?.phone,
          item.title,
          doctors.find((doc) => doc.id == item.docId)?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : requests;

  if (requests.length == 0) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-5">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Pending requests
          </h4>
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-red-100 bg-red-50 text-[10px] font-extrabold text-red-500">
            {requests.length}
          </span>
        </div>
        {isEditMode ? (
          <span className="text-[10px] font-semibold text-blue-600">
            Drag to schedule
          </span>
        ) : null}
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
  const { refetch } = useScheduleContext();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `pending-${item.id}`,
      data: {
        type: "pending_request",
        pendingRequestData: item,
      },
      disabled: !isEditMode,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleConfirm = async () => {
    if (!accessToken || !isApiAppointmentId(item.id)) return;
    setBusy(true);
    setActionError(null);
    try {
      await updateAppointmentStatus(item.id, { status: "CONFIRMED" }, accessToken);
      onRemovePendingRequest(item.id);
      refetch();
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
      refetch();
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
      ref={setNodeRef}
      style={style}
      className={`surface-card surface-card-hover relative flex min-h-[110px] overflow-hidden text-right transition-all duration-300 ${
        isEditMode ? "border-neutral-300" : "border-neutral-200 hover:border-blue-200/80"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <div
        {...(isEditMode ? { ...attributes, ...listeners } : {})}
        className={`flex shrink-0 items-center justify-center border-r border-neutral-200 bg-neutral-50/80 transition-all duration-350 select-none ${
          isEditMode
            ? "w-9 cursor-grab opacity-100 active:cursor-grabbing"
            : "pointer-events-none w-0 border-r-transparent opacity-0"
        }`}
      >
        <GripVertical className="h-4 w-4 shrink-0 text-neutral-400" />
      </div>

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

        {!isEditMode ? (
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
        ) : (
          <p className="mt-2 text-[10px] font-semibold text-blue-600">
            Drag onto an empty grid slot
          </p>
        )}
      </div>
    </div>
  );
}
