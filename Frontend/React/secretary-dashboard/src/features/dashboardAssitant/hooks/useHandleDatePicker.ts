import { addDays, subDays } from "date-fns";
import { create } from "zustand";
import type { HandleDatePickerState } from "../types";



// Pass <State> here so Zustand typed the state internally and externally
export const useHandleDatePicker = create<HandleDatePickerState>((set) => ({
  date: new Date(),
  handlePreviousDay: () =>
    set((state) => ({
      date: subDays(state.date, 1),
    })),
  handleNextDay: () =>
    set((state) => ({
      date: addDays(state.date, 1),
    })),
  handleGoToToday: () => set({ date: new Date() }),
  handleChangeDate: (newDate: Date) => set({ date: newDate }),
}));
