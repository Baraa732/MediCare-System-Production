import { create } from "zustand";

export interface AppointmentDialogPrefill {
  doctorId?: string;
  doctorName?: string;
  startSlot?: number;
  endSlot?: number;
}

interface AppointmentDialogState {
  isOpen: boolean;
  prefill: AppointmentDialogPrefill | null;
  openDialog: (prefill?: AppointmentDialogPrefill) => void;
  closeDialog: () => void;
}

export const useAppointmentDialog = create<AppointmentDialogState>((set) => ({
  isOpen: false,
  prefill: null,
  openDialog: (prefill) => set({ isOpen: true, prefill: prefill ?? null }),
  closeDialog: () => set({ isOpen: false, prefill: null }),
}));
