import { create } from "zustand";
import {
  ROW_MINUTES,
  SLOT_HEIGHT,
  START_TIME_MINUTES,
  TOTAL_HOURS,
} from "../data/scheduleGrid";

interface RedLineState {
  timeLineTop: number;
  currentTimeText: string;
  computeLinePosition: () => void;
}

export const useRedLine = create<RedLineState>((set) => ({
  timeLineTop: 0,
  currentTimeText: "",
  computeLinePosition: () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    let elapsedMinutes = currentHour * 60 + currentMin - START_TIME_MINUTES;
    if (elapsedMinutes < 0) elapsedMinutes += 24 * 60;

    const totalTableMinutes = TOTAL_HOURS * 60;
    if (elapsedMinutes >= 0 && elapsedMinutes <= totalTableMinutes) {
      const ratio = elapsedMinutes / ROW_MINUTES;
      set({ timeLineTop: ratio * SLOT_HEIGHT });
      const ampm = currentHour >= 12 ? "PM" : "AM";
      const displayHour = currentHour % 12 === 0 ? 12 : currentHour % 12;
      set({
        currentTimeText: `${displayHour}:${currentMin < 10 ? "0" + currentMin : currentMin} ${ampm}`,
      });
    } else {
      set({ timeLineTop: -1 });
    }
  },
}));
