import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useHandleDatePicker } from "@/features/dashboardAssitant/hooks/useHandleDatePicker";
import {
  useScheduleData,
  type DoctorWithAppointments,
} from "@/features/dashboardAssitant/hooks/useScheduleData";
import { usePendingRequestsSync } from "@/features/dashboardAssitant/hooks/usePendingRequestsSync";
import { useScheduleGridStore } from "@/features/dashboardAssitant/hooks/scheduleGridStore";
import { useHandleSelection } from "@/features/dashboardAssitant/hooks/useHandleSelection";
import type { ApiAppointment } from "@/lib/api/types";

interface ScheduleContextValue {
  doctors: DoctorWithAppointments[];
  appointments: ApiAppointment[];
  loading: boolean;
  error: string | null;
  clinicId?: string;
  clinicName?: string;
  selectedDate: Date;
  refetch: () => void;
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const selectedDate = useHandleDatePicker((s) => s.date);
  const schedule = useScheduleData(selectedDate);
  usePendingRequestsSync(schedule.clinicId);

  useEffect(() => {
    useScheduleGridStore.getState().setDoctors(schedule.doctors);
  }, [schedule.doctors]);

  // Clear drag-selection when navigating between days/pages.
  useEffect(() => {
    useHandleSelection.setState({ selection: null, isSelecting: false });
  }, [selectedDate]);

  return (
    <ScheduleContext.Provider value={{ ...schedule, selectedDate }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useScheduleContext() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) {
    throw new Error("useScheduleContext must be used within ScheduleProvider");
  }
  return ctx;
}
