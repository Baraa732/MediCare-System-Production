import type { AppointmentType } from "./AppointmentType";

export interface DragDataPayload {
  type: "doctor" | "appointment" | "pending_request";
  appointmentData?: AppointmentType;
}