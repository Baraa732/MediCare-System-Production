import { create } from "zustand";
import type { DoctorWithAppointments } from "./useScheduleData";

interface ScheduleGridStore {
  doctors: DoctorWithAppointments[];
  setDoctors: (doctors: DoctorWithAppointments[]) => void;
}

export const useScheduleGridStore = create<ScheduleGridStore>((set) => ({
  doctors: [],
  setDoctors: (doctors) => set({ doctors }),
}));
