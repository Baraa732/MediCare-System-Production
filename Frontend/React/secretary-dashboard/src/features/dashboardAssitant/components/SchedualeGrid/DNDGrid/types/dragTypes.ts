import type { DoctorType } from "@/features/dashboardAssitant/types";

export interface OverSlotInfo {
  docId: string;
  slotIdx: number;
  top: number;
  height: number;
}

export interface ToastInfo {
  patientName: string;
  newTimeLabel: string;
}

export type ActiveDragType = "doctor" | "appointment" | "pending_request" | null;

export interface DragState {
  activeId: string | null;
  activeType: ActiveDragType;
  activeData: import("@/features/dashboardAssitant/types").DragDataPayload | null;
  overSlotInfo: OverSlotInfo | null;
  snapshotDoctors: DoctorType[] | null;
}