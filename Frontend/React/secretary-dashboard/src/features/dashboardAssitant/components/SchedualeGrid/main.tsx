import { useRedLine } from "../../hooks/useRedLine";
import { useHandleSelection } from "../../hooks/useHandleSelection";
import { useEditeMode } from "../../hooks/useEditeMode";
import { DNDGrid, InformationPanel } from ".";
import { AlertTriangle } from "lucide-react";
import React from "react";
import { throttle } from "@/lib/perf";

export function ScheduleGrid() {
  const computeLinePosition = useRedLine((state) => state.computeLinePosition);
  const handleKeyDown = useHandleSelection((state) => state.handleKeyDown);
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const onToggleEdit = useEditeMode((state) => state.onToggleEdit);

  const throttledLineUpdate = React.useMemo(
    () => throttle(() => computeLinePosition(), 1000),
    [computeLinePosition],
  );

  React.useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  React.useEffect(() => {
    computeLinePosition();
    const interval = window.setInterval(throttledLineUpdate, 1000);
    return () => window.clearInterval(interval);
  }, [computeLinePosition, throttledLineUpdate]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white select-none contain-layout">
      <div
        className={`z-40 w-full shrink-0 overflow-hidden bg-blue-50 text-xs font-bold text-blue-900 transition-[max-height,opacity,padding] duration-300 ease-out ${
          isEditMode
            ? "max-h-16 border-b border-blue-200 px-5 py-3 opacity-100"
            : "max-h-0 border-b-transparent px-5 py-0 opacity-0"
        }`}
      >
        <div
          className={`flex w-full items-center justify-between transition-all duration-300 ${
            isEditMode ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse text-blue-600" />
            <span>
              Edit mode: drag a card by the grip to a new time or doctor. Occupied slots are blocked. Past / finished visits stay locked.
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleEdit}
            className="cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-extrabold text-white shadow-xs transition-all duration-200 hover:bg-blue-700 active:scale-95"
          >
            Exit edit mode
          </button>
        </div>
      </div>

      <DNDGrid />
      <InformationPanel />
    </div>
  );
}
