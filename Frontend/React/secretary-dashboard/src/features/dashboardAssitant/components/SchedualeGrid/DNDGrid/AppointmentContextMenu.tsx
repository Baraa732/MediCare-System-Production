import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Calendar, UserPlus, ArrowUp, ArrowDown } from "lucide-react";
import type { AppointmentType, DoctorType } from "@/features/dashboardAssitant/types";
import {
  getAvailableDoctorsForTransfer,
  getValidEarlierIntervals,
  getValidLaterIntervals,
} from "./utils/conflictValidator";
import { useWizardDrawer } from "@/features/dashboardAssitant/hooks/useWizardDrawer";
import { useScheduleContext } from "@/features/dashboardAssitant/context/ScheduleContext";

interface ContextMenuState {
  appointment: AppointmentType;
  x: number;
  y: number;
}

type SubmenuType = "transfer" | "earlier" | "later" | null;

export function AppointmentContextMenu({
  doctors,
  onExecuteAction,
}: {
  doctors: DoctorType[];
  onExecuteAction: (updatedApt: AppointmentType) => void;
}) {
  const openWithEditAppointment = useWizardDrawer(
    (s) => s.openWithEditAppointment,
  );
  const { selectedDate } = useScheduleContext();
  const [menuState, setMenuState] = useState<ContextMenuState | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuType>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOpenMenu = (e: Event) => {
      const customEvent = e as CustomEvent<{
        appointment: AppointmentType;
        x: number;
        y: number;
      }>;
      const { appointment, x, y } = customEvent.detail;

      const safeX = x + 220 > window.innerWidth ? window.innerWidth - 230 : x;
      const safeY = y + 240 > window.innerHeight ? window.innerHeight - 250 : y;

      setMenuState({ appointment, x: safeX, y: safeY });
      setActiveSubmenu(null);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuState(null);
        setActiveSubmenu(null);
      }
    };

    window.addEventListener("open-appointment-menu", handleOpenMenu);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("open-appointment-menu", handleOpenMenu);
      document.removeEventListener("mousedown", handleClickOutside);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  if (!menuState) return null;

  const { appointment, x, y } = menuState;
  const availableDocs = getAvailableDoctorsForTransfer(appointment, doctors);
  const earlierIntervals = getValidEarlierIntervals(
    appointment,
    doctors,
    selectedDate,
  );
  const laterIntervals = getValidLaterIntervals(
    appointment,
    doctors,
    selectedDate,
  );

  const handleTrigger = (updated: AppointmentType) => {
    onExecuteAction(updated);
    setMenuState(null);
    setActiveSubmenu(null);
  };

  const handleMouseEnterItem = (type: SubmenuType, hasItems: boolean) => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (hasItems) {
      setActiveSubmenu(type);
    } else {
      setActiveSubmenu(null);
    }
  };

  const handleMouseLeaveItem = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 150);
  };

  const keepSubmenuOpen = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  };

  return (
    <div
      ref={menuRef}
      style={{ top: y, left: x }}
      className="fixed min-w-[210px] bg-white border border-neutral-200/70 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-1.5 z-[999] flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 select-none text-right"
    >
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
        onClick={() => {
          openWithEditAppointment(appointment, false);
          setMenuState(null);
        }}
        onMouseEnter={() => handleMouseEnterItem(null, false)}
      >
        <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <span className="font-medium text-neutral-700">Reschedule</span>
      </button>

      {(availableDocs.length > 0 ||
        earlierIntervals.length > 0 ||
        laterIntervals.length > 0) && (
        <div className="h-px bg-neutral-100/80 my-1" />
      )}

      {availableDocs.length > 0 ? (
        <div
          className="relative"
          onMouseEnter={() =>
            handleMouseEnterItem("transfer", availableDocs.length > 0)
          }
          onMouseLeave={handleMouseLeaveItem}
        >
          <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer">
            <ChevronLeft
              className={`w-3 h-3 text-neutral-400 transition-transform ${activeSubmenu === "transfer" ? "-translate-x-0.5" : ""}`}
            />
            <div className="flex items-center gap-2">
              <span className="font-medium text-neutral-700">Transfer Doctor</span>
              <UserPlus className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            </div>
          </button>

          {activeSubmenu === "transfer" && (
            <div
              onMouseEnter={keepSubmenuOpen}
              className="absolute right-full top-0 mr-1 flex flex-col min-w-[170px] bg-white border border-neutral-200/80 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in slide-in-from-right-1 duration-100 max-h-52 overflow-y-auto scrollbar-thin after:absolute after:top-0 after:bottom-0 after:-right-2 after:w-2 after:content-['']"
            >
              {availableDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleTrigger({ ...appointment, docId: doc.id })}
                  className="w-full text-right px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-blue-50/80 hover:text-blue-600 rounded-md transition-colors cursor-pointer"
                >
                  {doc.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {earlierIntervals.length > 0 ? (
        <div
          className="relative"
          onMouseEnter={() =>
            handleMouseEnterItem("earlier", earlierIntervals.length > 0)
          }
          onMouseLeave={handleMouseLeaveItem}
        >
          <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer">
            <ChevronLeft
              className={`w-3 h-3 text-neutral-400 transition-transform ${activeSubmenu === "earlier" ? "-translate-x-0.5" : ""}`}
            />
            <div className="flex items-center gap-2">
              <span className="font-medium text-neutral-700">Shift Earlier</span>
              <ArrowUp className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            </div>
          </button>

          {activeSubmenu === "earlier" && (
            <div
              onMouseEnter={keepSubmenuOpen}
              className="absolute right-full top-0 mr-1 flex flex-col min-w-[130px] bg-white border border-neutral-200/80 rounded-xl shadow-xl p-1.5 max-h-48 overflow-y-auto scrollbar-thin z-50 animate-in fade-in slide-in-from-right-1 duration-100 after:absolute after:top-0 after:bottom-0 after:-right-2 after:w-2 after:content-['']"
            >
              {earlierIntervals.map((mins) => (
                <button
                  key={mins}
                  onClick={() =>
                    handleTrigger({
                      ...appointment,
                      start: appointment.start - mins,
                      end: appointment.end - mins,
                    })
                  }
                  className="w-full text-right px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-blue-50/80 hover:text-blue-600 rounded-md transition-colors cursor-pointer"
                >
                  {mins} mins
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {laterIntervals.length > 0 ? (
        <div
          className="relative"
          onMouseEnter={() =>
            handleMouseEnterItem("later", laterIntervals.length > 0)
          }
          onMouseLeave={handleMouseLeaveItem}
        >
          <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer">
            <ChevronLeft
              className={`w-3 h-3 text-neutral-400 transition-transform ${activeSubmenu === "later" ? "-translate-x-0.5" : ""}`}
            />
            <div className="flex items-center gap-2">
              <span className="font-medium text-neutral-700">Shift Later</span>
              <ArrowDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            </div>
          </button>

          {activeSubmenu === "later" && (
            <div
              onMouseEnter={keepSubmenuOpen}
              className="absolute right-full top-0 mr-1 flex flex-col min-w-[130px] bg-white border border-neutral-200/80 rounded-xl shadow-xl p-1.5 max-h-48 overflow-y-auto scrollbar-thin z-50 animate-in fade-in slide-in-from-right-1 duration-100 after:absolute after:top-0 after:bottom-0 after:-right-2 after:w-2 after:content-['']"
            >
              {laterIntervals.map((mins) => (
                <button
                  key={mins}
                  onClick={() =>
                    handleTrigger({
                      ...appointment,
                      start: appointment.start + mins,
                      end: appointment.end + mins,
                    })
                  }
                  className="w-full text-right px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-blue-50/80 hover:text-blue-600 rounded-md transition-colors cursor-pointer"
                >
                  {mins} mins
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
