import { RedTimeBox } from ".";
import { TOTAL_SLOTS, START_TIME_MINUTES, ROW_MINUTES, SLOT_HEIGHT } from "../../data/scheduleGrid";

export function TimeColumn() {
  return (
    // <div className="w-24 sticky left-0 z-30 bg-white border-r border-neutral-200 flex flex-col text-right font-mono pr-4 text-[11px] font-bold text-neutral-400 relative shrink-0">
    <div className="w-24 sticky left-0 z-30 bg-white border-r border-neutral-200 flex flex-col text-right font-mono pr-4 text-[11px] font-bold text-neutral-400 shrink-0">
      {Array.from({ length: TOTAL_SLOTS + 1 }).map((_, index) => {
        let currentTotalMinutes = START_TIME_MINUTES + index * ROW_MINUTES;
        if (currentTotalMinutes >= 24 * 60) currentTotalMinutes -= 24 * 60;

        const hour = Math.floor(currentTotalMinutes / 60);
        const minutes = currentTotalMinutes % 60;
        const displayHour = hour === 0 || hour === 12 ? 12 : hour % 12;
        const ampm = hour >= 12 ? "PM" : "AM";

        if (minutes !== 0 && minutes !== 30) {
          return (
            <div
              key={index}
              style={{ height: SLOT_HEIGHT }}
              className="border-b border-transparent"
            />
          );
        }

        return (
          <div
            key={index}
            style={{ height: SLOT_HEIGHT, top: index * SLOT_HEIGHT }}
            className="absolute right-4 -translate-y-2 leading-none flex items-center justify-end"
          >
            {`${displayHour}:${minutes === 0 ? "00" : minutes} ${ampm}`}
          </div>
        );
      })}
      <RedTimeBox />
    </div>
  );
}