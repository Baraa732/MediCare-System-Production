import type { AppointmentType } from "./AppointmentType";
import type { PendingRequest } from "./PendingRequest";

export interface DragDataPayload {
  type: "doctor" | "appointment" | "pending_request";
  appointmentData?: AppointmentType;
  pendingRequestData?: PendingRequest;
}