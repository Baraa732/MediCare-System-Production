import { create } from "zustand";

export interface ConflictingItem {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  start: number;
  end: number;
  overlapMinutes: number;
}

export interface ConflictPayload {
  conflictingItems: ConflictingItem[];
  attemptedAction: "move" | "assign";
}

interface GlobalConflictStore {
  conflictPayload: ConflictPayload | null;
  isDrawerOpen: boolean;
  setConflict: (payload: ConflictPayload | null) => void;
  setDrawerOpen: (isOpen: boolean) => void;
  clearConflict: () => void;
}

export const useGlobalConflictStore = create<GlobalConflictStore>((set) => ({
  conflictPayload: null,
  isDrawerOpen: false,
  setConflict: (payload) => set({ conflictPayload: payload }),
  setDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),
  clearConflict: () => set({ conflictPayload: null, isDrawerOpen: false }),
}));
