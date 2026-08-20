import { create } from "zustand";
import {
  ROW_MINUTES,
  SLOT_HEIGHT,
  START_TIME_MINUTES,
  TOTAL_HOURS,
} from "../data/scheduleGrid";
import { absoluteMinutesInClinic, clinicDateKey } from "@/lib/time/clinicTime";
import { useHandleDatePicker } from "./useHandleDatePicker";

interface RedLineState {
  timeLineTop: number;
  currentTimeText: string;
  computeLinePosition: () => void;
}

export const useRedLine = create<RedLineState>((set) => ({
  timeLineTop: -1,
  currentTimeText: "",
  computeLinePosition: () => {
    const now = new Date();
    const selectedDate = useHandleDatePicker.getState().date;
    const absMinutes = absoluteMinutesInClinic(now);
    const currentHour = Math.floor(absMinutes / 60);
    const currentMin = absMinutes % 60;
    const ampm = currentHour >= 12 ? "PM" : "AM";
    const displayHour = currentHour % 12 === 0 ? 12 : currentHour % 12;
    const currentTimeText = `${displayHour}:${currentMin < 10 ? "0" + currentMin : currentMin} ${ampm}`;

    if (clinicDateKey(selectedDate) !== clinicDateKey(now)) {
      set({ timeLineTop: -1, currentTimeText });
      return;
    }

    const elapsedMinutes = absMinutes - START_TIME_MINUTES;
    const totalTableMinutes = TOTAL_HOURS * 60;

    if (elapsedMinutes >= 0 && elapsedMinutes <= totalTableMinutes) {
      set({
        timeLineTop: (elapsedMinutes / ROW_MINUTES) * SLOT_HEIGHT,
        currentTimeText,
      });
      return;
    }

    set({ timeLineTop: -1, currentTimeText });
  },
}));
