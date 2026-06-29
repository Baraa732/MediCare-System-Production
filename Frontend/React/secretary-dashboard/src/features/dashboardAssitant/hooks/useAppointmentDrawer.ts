import { create } from "zustand";

interface AppointmentDrawerState {
  appointmentId: string | null;
  open: (appointmentId: string) => void;
  close: () => void;
}

export const useAppointmentDrawer = create<AppointmentDrawerState>((set) => ({
  appointmentId: null,
  open: (appointmentId) => set({ appointmentId }),
  close: () => set({ appointmentId: null }),
}));
