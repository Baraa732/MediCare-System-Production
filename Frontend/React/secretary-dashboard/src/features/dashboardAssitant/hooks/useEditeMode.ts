import { create } from "zustand";
import type { EditModeState } from "../types";



export const useEditeMode = create<EditModeState>((set) => ({
  isEditMode: false,
  onToggleEdit: () => set((state) => ({ isEditMode: !state.isEditMode })),
}));
