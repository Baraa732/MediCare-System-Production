import type { AppointmentType } from "./AppointmentType";

export type PendingRequest = AppointmentType & { timeRequistAgo: number };
