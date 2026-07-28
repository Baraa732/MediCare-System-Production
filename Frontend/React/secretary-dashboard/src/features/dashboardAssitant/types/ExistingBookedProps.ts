import type { AppointmentType } from "./AppointmentType";

export interface ExistingBookedProps {
  columnAppointments: AppointmentType[];
  docId: string;
  overSlotInfo?: {
    docId: string;
    slotIdx: number;
    top: number;
    height: number;
  } | null;
}