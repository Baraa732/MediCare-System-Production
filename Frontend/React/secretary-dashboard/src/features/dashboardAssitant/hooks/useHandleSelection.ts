// useHandleSelection.ts
import { create } from "zustand";
import type { SelectionType } from "../types";
import { ROW_MINUTES } from "../data/scheduleGrid";
import { useScheduleGridStore } from "./scheduleGridStore";
import { useWizardDrawer } from "./useWizardDrawer";
import { useHandleDatePicker } from "./useHandleDatePicker";
import {
  absoluteMinutesFromGridSlot,
  slotRangeDurationMinutes,
} from "@/lib/time/gridTime";
import { isGridSlotInPast, isClinicDateBeforeToday } from "../utils/editModeDrag";
import { isGridRangeOutsideClinicHours } from "../utils/clinicHours";

interface HandleSelectionState {
  selection: SelectionType;
  isSelecting: boolean;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleSelectionCommit: () => void;
  handleCreateAppointment: (e: React.MouseEvent) => void;
  onMouseEnter: (params: { idDoctor: string; slotIdx: number }) => void;
  onMouseDown: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    params: { isEditMode: boolean; idDoctor: string; slotIdx: number },
  ) => void;
}

export const useHandleSelection = create<HandleSelectionState>((set) => {
  const isTimeRangeOccupied = (
    docId: string,
    startMinutes: number,
    endMinutes: number,
  ) => {
    const doc = useScheduleGridStore
      .getState()
      .doctors.find((d) => d.id === docId);
    const columnAppointments = doc?.appointments ?? [];
    return columnAppointments.some(
      (apt) => startMinutes < apt.end && endMinutes > apt.start,
    );
  };

  return {
    selection: null,
    isSelecting: false,

    handleKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape") set({ selection: null, isSelecting: false });
    },

    // 2️⃣ عند إفلات الفأرة: نكتفي بإنهاء حالة السحب فقط (لتظل المنطقة والزر الأزرق ظاهرين)
    handleSelectionCommit: () => {
      set({ isSelecting: false });
    },

    // 3️⃣ عند الضغط الفعلي على زر New Appointment الأزرق داخل المساحة
    handleCreateAppointment: (e: React.MouseEvent) => {
      e.stopPropagation();

      set((state) => {
        if (state.selection) {
          const minSlot = Math.min(
            state.selection.startSlot,
            state.selection.endSlot,
          );
          const maxSlot = Math.max(
            state.selection.startSlot,
            state.selection.endSlot,
          );
          const date = useHandleDatePicker.getState().date;
          if (isGridSlotInPast(minSlot * ROW_MINUTES, date)) {
            return { selection: null };
          }
          const startMinutes = minSlot * ROW_MINUTES;
          const endMinutes = (maxSlot + 1) * ROW_MINUTES;
          const hours = useScheduleGridStore.getState().clinicHours;
          if (
            isGridRangeOutsideClinicHours(startMinutes, endMinutes, date, hours)
          ) {
            return { selection: null };
          }
          const duration = slotRangeDurationMinutes(minSlot, maxSlot);
          const doctor = useScheduleGridStore
            .getState()
            .doctors.find((d) => d.id === state.selection!.docId);

          useWizardDrawer.getState().onOpenNewAppointment({
            doctorId: state.selection.docId,
            doctorName: doctor?.name,
            timeSlot: absoluteMinutesFromGridSlot(minSlot),
            duration,
            date,
            startSlot: minSlot,
            endSlot: maxSlot,
            fromGridSelection: true,
          });
          return { selection: null };
        }
        return {};
      });
    },

    onMouseDown: (e, { idDoctor, isEditMode, slotIdx }) => {
      if (isEditMode || e.button !== 0) return;
      const date = useHandleDatePicker.getState().date;
      if (isClinicDateBeforeToday(date)) return;
      if (isGridSlotInPast(slotIdx * ROW_MINUTES, date)) return;
      const hours = useScheduleGridStore.getState().clinicHours;
      if (
        isGridRangeOutsideClinicHours(
          slotIdx * ROW_MINUTES,
          (slotIdx + 1) * ROW_MINUTES,
          date,
          hours,
        )
      ) {
        return;
      }
      set({
        isSelecting: true,
        selection: { docId: idDoctor, startSlot: slotIdx, endSlot: slotIdx },
      });
    },

    onMouseEnter: ({ idDoctor, slotIdx }) =>
      set((state) => {
        if (
          !state.isSelecting ||
          !state.selection ||
          state.selection.docId !== idDoctor
        )
          return {};

        const date = useHandleDatePicker.getState().date;
        if (isGridSlotInPast(slotIdx * ROW_MINUTES, date)) return {};

        const potentialMinSlot = Math.min(state.selection.startSlot, slotIdx);
        const potentialMaxSlot = Math.max(state.selection.startSlot, slotIdx);
        if (isGridSlotInPast(potentialMinSlot * ROW_MINUTES, date)) return {};

        const targetStartMinutes = potentialMinSlot * ROW_MINUTES;
        const targetEndMinutes = (potentialMaxSlot + 1) * ROW_MINUTES;
        const hours = useScheduleGridStore.getState().clinicHours;
        if (
          isGridRangeOutsideClinicHours(
            targetStartMinutes,
            targetEndMinutes,
            date,
            hours,
          )
        ) {
          return {};
        }

        if (
          !isTimeRangeOccupied(idDoctor, targetStartMinutes, targetEndMinutes)
        ) {
          return { selection: { ...state.selection, endSlot: slotIdx } };
        }
        return {};
      }),
  };
});
