import { create } from "zustand";
import type { DoctorWithAppointments } from "./useScheduleData";

interface ScheduleGridStore {
  doctors: DoctorWithAppointments[];
  searchQuery: string;
  setDoctors: (doctors: DoctorWithAppointments[]) => void;
  setSearchQuery: (query: string) => void;
}

export const useScheduleGridStore = create<ScheduleGridStore>((set) => ({
  doctors: [],
  searchQuery: "",
  setDoctors: (doctors) => set({ doctors }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
