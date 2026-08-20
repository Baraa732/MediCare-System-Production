import { cn } from "@/lib/utils";
import { Info, ChevronDown } from "lucide-react";
import React from "react";
import { informationPanelData } from "../../data/scheduleGrid";
import { UNAVAILABLE_STATUS_STYLE } from "../../utils/appointmentStatusStyles";

export function InformationPanel() {
  const [showLegend, setShowLegend] = React.useState(true);

  return (
    <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end">
      <button
        onClick={() => setShowLegend(!showLegend)}
        className="floating-panel flex h-9 items-center gap-2 px-4 text-xs font-bold text-neutral-700 transition-all duration-200 hover:-translate-y-px cursor-pointer"
      >
        <Info className="w-4 h-4 text-neutral-400" />
        <span>Information panel</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-neutral-400 transition-transform",
            !showLegend && "rotate-180",
          )}
        />
      </button>

      {showLegend && (
        <div className="floating-panel fade-up w-64 space-y-4 p-4 mt-2">
          <div>
            <h5 className="text-[10px] font-bold tracking-wider uppercase text-neutral-400 mb-2">
              Appointment status
            </h5>
            <div className="space-y-2 text-xs font-semibold text-neutral-600">
              {informationPanelData.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <div
                    className={cn("w-4 h-4 rounded-md border", s.border, s.bg)}
                  />
                  <span>{s.name}</span>
                </div>
              ))}
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "w-4 h-4 rounded-md border",
                    UNAVAILABLE_STATUS_STYLE.border,
                    UNAVAILABLE_STATUS_STYLE.bg,
                  )}
                />
                <span>{UNAVAILABLE_STATUS_STYLE.name}</span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-neutral-100">
            <h5 className="text-[10px] font-bold tracking-wider uppercase text-neutral-400 mb-2">
              Additional indicators
            </h5>
            <div className="space-y-2 text-xs font-semibold text-neutral-600">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>URGENT</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}