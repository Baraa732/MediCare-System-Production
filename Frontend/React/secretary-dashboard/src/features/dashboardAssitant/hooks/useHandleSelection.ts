import { create } from "zustand";
import type { ColumnAppointmentsType, SelectionType } from "../types";
import { ROW_MINUTES } from "../data/scheduleGrid";
import { useAppointmentDialog } from "./useAppointmentDialog";

interface HandleSelectionState {
  selection: SelectionType;
  isSelecting: boolean;
  liveAppointments: ColumnAppointmentsType[];
  setLiveAppointments: (appointments: ColumnAppointmentsType[]) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleSelectionCommit: () => void;
  handleCreateAppointment: (
    e: React.MouseEvent,
    doctorName?: string,
  ) => void;
  onMouseEnter: (params: { idDoctor: string; slotIdx: number }) => void;
  onMouseDown: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    params: { isEditMode: boolean; idDoctor: string; slotIdx: number },
  ) => void;
}

export const useHandleSelection = create<HandleSelectionState>((set, get) => {
  const isTimeRangeOccupied = (
    docId: string,
    startMinutes: number,
    endMinutes: number,
  ) => {
    const columnAppointments = get().liveAppointments.filter(
      (a) => a.docId === docId,
    );
    return columnAppointments.some(
      (apt) => startMinutes < apt.end && endMinutes > apt.start,
    );
  };

  return {
    selection: null,
    isSelecting: false,
    liveAppointments: [],

    setLiveAppointments: (appointments) => set({ liveAppointments: appointments }),

    handleKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        set({ selection: null, isSelecting: false });
      }
    },

    handleSelectionCommit: () => {
      set({ isSelecting: false });
    },

    handleCreateAppointment: (e: React.MouseEvent, doctorName?: string) => {
      e.stopPropagation();

      const { selection } = get();
      if (!selection) return;

      const minSlot = Math.min(selection.startSlot, selection.endSlot);
      const maxSlot = Math.max(selection.startSlot, selection.endSlot);

      useAppointmentDialog.getState().openDialog({
        doctorId: selection.docId,
        doctorName,
        startSlot: minSlot,
        endSlot: maxSlot,
      });

      set({ selection: null, isSelecting: false });
    },

    onMouseDown: (
      e: React.MouseEvent<HTMLDivElement, MouseEvent>,
      { idDoctor, isEditMode, slotIdx },
    ) => {
      if (isEditMode || e.button !== 0) return;
      set({
        isSelecting: true,
        selection: {
          docId: idDoctor,
          startSlot: slotIdx,
          endSlot: slotIdx,
        },
      });
    },

    onMouseEnter: ({ idDoctor, slotIdx }) =>
      set((state) => {
        if (
          !state.isSelecting ||
          !state.selection ||
          state.selection.docId !== idDoctor
        ) {
          return {};
        }

        const potentialMinSlot = Math.min(state.selection.startSlot, slotIdx);
        const potentialMaxSlot = Math.max(state.selection.startSlot, slotIdx);

        const targetStartMinutes = potentialMinSlot * ROW_MINUTES;
        const targetEndMinutes = (potentialMaxSlot + 1) * ROW_MINUTES;

        if (
          !isTimeRangeOccupied(idDoctor, targetStartMinutes, targetEndMinutes)
        ) {
          return {
            selection: {
              ...state.selection,
              endSlot: slotIdx,
            },
          };
        }

        return {};
      }),
  };
});
