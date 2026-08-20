import { useRedLine } from "../../hooks/useRedLine";
import { useHandleSelection } from "../../hooks/useHandleSelection";
import { useEditeMode } from "../../hooks/useEditeMode";
import { DNDGrid, InformationPanel } from ".";
import { AlertTriangle, Save, RotateCcw } from "lucide-react";
import React from "react";
import { throttle } from "@/lib/perf";
import { useScheduleDnd } from "../../context/ScheduleDndContext";

export function ScheduleGrid() {
  const computeLinePosition = useRedLine((state) => state.computeLinePosition);
  const handleKeyDown = useHandleSelection((state) => state.handleKeyDown);
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const {
    dirtyCount,
    isSaving,
    saveError,
    saveEditChanges,
    discardEditChanges,
    requestExitEditMode,
  } = useScheduleDnd();

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
            ? "max-h-28 border-b border-blue-200 px-5 py-3 opacity-100"
            : "max-h-0 border-b-transparent px-5 py-0 opacity-0"
        }`}
      >
        <div
          className={`flex w-full flex-col gap-2 transition-all duration-300 ${
            isEditMode
              ? "translate-y-0 scale-100 opacity-100"
              : "-translate-y-2 scale-95 opacity-0"
          }`}
        >
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse text-blue-600" />
              <span>
                Edit mode: rearrange freely. Changes stay local until you click{" "}
                <strong>Save changes</strong>.
                {dirtyCount > 0 ? (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                    {dirtyCount} unsaved
                  </span>
                ) : null}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSaving || dirtyCount === 0}
                onClick={() => void discardEditChanges()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700 shadow-xs transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Discard
              </button>
              <button
                type="button"
                disabled={isSaving || dirtyCount === 0}
                onClick={() => void saveEditChanges()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold text-white shadow-xs transition-all duration-200 hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={requestExitEditMode}
                className="cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-extrabold text-white shadow-xs transition-all duration-200 hover:bg-blue-700 active:scale-95 disabled:opacity-40"
              >
                Exit edit mode
              </button>
            </div>
          </div>
          {saveError ? (
            <p className="text-[11px] font-semibold text-red-600">{saveError}</p>
          ) : (
            <p className="text-[11px] font-medium text-blue-700/80">
              After save, patients and staff receive reschedule notifications
              automatically.
            </p>
          )}
        </div>
      </div>

      <DNDGrid />
      <InformationPanel />
    </div>
  );
}
