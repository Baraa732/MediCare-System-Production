import { create } from "zustand";
import type { ToggleSideBarState } from "../types";



export const useToggleSideBar = create<ToggleSideBarState>((set) => ({
  isSidebarOpen: true,
  onToggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));
