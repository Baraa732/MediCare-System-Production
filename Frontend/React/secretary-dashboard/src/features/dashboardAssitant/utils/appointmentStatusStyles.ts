/**
 * Canonical appointment status colors — must match the Information Panel legend.
 */
export type AppointmentDisplayStatus =
  | "confirmed"
  | "done"
  | "in_progress"
  | "late"
  | "pending_request"
  | "no-show"
  | "unavailable"
  | "cancelled";

export type AppointmentStatusLegendItem = {
  key: AppointmentDisplayStatus;
  name: string;
  border: string;
  bg: string;
  text: string;
  cardBorder: string;
};

export const APPOINTMENT_STATUS_LEGEND: AppointmentStatusLegendItem[] = [
  {
    key: "confirmed",
    name: "Confirmed",
    border: "border-blue-300",
    bg: "bg-[#E2F1FF]",
    text: "text-[#0055cc]",
    cardBorder: "border-blue-200/80",
  },
  {
    key: "done",
    name: "Done/Checked-In",
    border: "border-green-300",
    bg: "bg-green-50",
    text: "text-green-700",
    cardBorder: "border-green-200/80",
  },
  {
    key: "in_progress",
    name: "In progress",
    border: "border-purple-300",
    bg: "bg-purple-50",
    text: "text-purple-700",
    cardBorder: "border-purple-200/80",
  },
  {
    key: "late",
    name: "Late",
    border: "border-rose-300",
    bg: "bg-rose-50",
    text: "text-rose-700",
    cardBorder: "border-rose-200/80",
  },
  {
    key: "pending_request",
    name: "Pending request",
    border: "border-red-200",
    bg: "bg-red-50/50",
    text: "text-red-700",
    cardBorder: "border-red-200/80",
  },
  {
    key: "no-show",
    name: "No-Show",
    border: "border-red-300",
    bg: "bg-red-50",
    text: "text-red-700",
    cardBorder: "border-red-200/80",
  },
];

export const UNAVAILABLE_STATUS_STYLE = {
  key: "unavailable" as const,
  name: "Unavailable",
  border: "border-neutral-300 border-dashed",
  bg: "bg-neutral-50",
  text: "text-neutral-400",
  cardBorder: "border-neutral-200",
};

const STATUS_ALIASES: Record<string, AppointmentDisplayStatus> = {
  confirmed: "confirmed",
  CONFIRMED: "confirmed",
  done: "done",
  completed: "done",
  COMPLETED: "done",
  in_progress: "in_progress",
  IN_PROGRESS: "in_progress",
  late: "late",
  LATE: "late",
  pending_request: "pending_request",
  requested: "pending_request",
  REQUESTED: "pending_request",
  "no-show": "no-show",
  no_show: "no-show",
  NO_SHOW: "no-show",
  unavailable: "unavailable",
  cancelled: "cancelled",
  CANCELLED: "cancelled",
  urgent: "confirmed",
};

const LEGEND_BY_KEY = Object.fromEntries(
  APPOINTMENT_STATUS_LEGEND.map((item) => [item.key, item]),
) as Record<AppointmentDisplayStatus, AppointmentStatusLegendItem>;

export function normalizeAppointmentStatus(
  status?: string | null,
): AppointmentDisplayStatus {
  if (!status) return "confirmed";
  return STATUS_ALIASES[status] ?? STATUS_ALIASES[status.toLowerCase()] ?? "confirmed";
}

/**
 * Derive live grid status from base status + schedule position (for confirmed slots).
 */
export function resolveDisplayStatus(
  status: string | undefined | null,
  options?: {
    startMinutes?: number;
    endMinutes?: number;
    nowMinutes?: number;
    scheduledDate?: Date;
    referenceDate?: Date;
  },
): AppointmentDisplayStatus {
  const base = normalizeAppointmentStatus(status);

  if (base !== "confirmed") {
    return base;
  }

  const {
    startMinutes,
    endMinutes,
    nowMinutes,
    scheduledDate,
    referenceDate = new Date(),
  } = options ?? {};

  if (
    scheduledDate &&
    scheduledDate.toDateString() !== referenceDate.toDateString()
  ) {
    return base;
  }

  if (
    startMinutes == null ||
    endMinutes == null ||
    nowMinutes == null ||
    !Number.isFinite(startMinutes) ||
    !Number.isFinite(endMinutes) ||
    !Number.isFinite(nowMinutes)
  ) {
    return base;
  }

  if (nowMinutes >= startMinutes && nowMinutes <= endMinutes) {
    return "in_progress";
  }

  if (nowMinutes > endMinutes) {
    return "late";
  }

  return "confirmed";
}

export function getStatusLegendItem(
  status: string | undefined | null,
  options?: {
    startMinutes?: number;
    endMinutes?: number;
    nowMinutes?: number;
    scheduledDate?: Date;
    referenceDate?: Date;
  },
): AppointmentStatusLegendItem | typeof UNAVAILABLE_STATUS_STYLE {
  const display = resolveDisplayStatus(status, options);
  if (display === "unavailable") {
    return UNAVAILABLE_STATUS_STYLE;
  }
  if (display === "cancelled") {
    return {
      key: "cancelled",
      name: "Cancelled",
      border: "border-neutral-300",
      bg: "bg-neutral-100",
      text: "text-neutral-600",
      cardBorder: "border-neutral-200",
    };
  }
  return LEGEND_BY_KEY[display] ?? LEGEND_BY_KEY.confirmed;
}

export function getAppointmentCardClasses(
  status: string | undefined | null,
  options?: {
    startMinutes?: number;
    endMinutes?: number;
    nowMinutes?: number;
    scheduledDate?: Date;
    referenceDate?: Date;
  },
): string {
  const item = getStatusLegendItem(status, options);
  if (item.key === "unavailable") {
    return `${item.bg} ${item.cardBorder} ${item.text} line-through opacity-75 border-dashed`;
  }
  return `${item.bg} ${item.cardBorder} ${item.text}`;
}

export function getAppointmentBorderClass(
  status: string | undefined | null,
  options?: {
    startMinutes?: number;
    endMinutes?: number;
    nowMinutes?: number;
    scheduledDate?: Date;
    referenceDate?: Date;
  },
): string {
  const item = getStatusLegendItem(status, options);
  return item.cardBorder;
}

/** Badge classes for API-level statuses in drawers and detail views. */
export function getApiStatusBadgeMeta(
  status: string,
  options?: {
    startMinutes?: number;
    endMinutes?: number;
    nowMinutes?: number;
    scheduledDate?: Date;
    referenceDate?: Date;
  },
) {
  const display = resolveDisplayStatus(status, options);
  const item = getStatusLegendItem(status, options);

  const labels: Record<AppointmentDisplayStatus, string> = {
    confirmed: "Confirmed",
    done: "Completed",
    in_progress: "In progress",
    late: "Late",
    pending_request: "Pending review",
    "no-show": "No-show",
    unavailable: "Unavailable",
    cancelled: "Cancelled",
  };

  return {
    label: labels[display] ?? status,
    className: `${item.bg} ${item.text} ring-1 ${item.border}`,
  };
}

export function getStatusOverlayClasses(
  status: string | undefined | null,
  options?: {
    startMinutes?: number;
    endMinutes?: number;
    nowMinutes?: number;
    scheduledDate?: Date;
    referenceDate?: Date;
  },
): string {
  const item = getStatusLegendItem(status, options);
  if (item.key === "unavailable") {
    return `${item.bg} ${item.border} ${item.text}`;
  }
  return `${item.bg} ${item.border} ${item.text}`;
}
