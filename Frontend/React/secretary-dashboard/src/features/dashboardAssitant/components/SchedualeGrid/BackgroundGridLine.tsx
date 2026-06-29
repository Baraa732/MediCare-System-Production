import { cn } from "@/lib/utils";
import { SLOT_HEIGHT, TOTAL_SLOTS } from "../../data/scheduleGrid";

export function BackgroundGridLine() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 flex flex-col">
      {Array.from({ length: TOTAL_SLOTS }).map((_, idx) => (
        <div
          key={idx}
          style={{ height: SLOT_HEIGHT }}
          className={cn(
            "w-full border-b",
            (idx + 1) % 4 === 0
              ? "border-neutral-200 border-solid"
              : "border-neutral-100 border-dashed",
          )}
        />
      ))}
    </div>
  );
}