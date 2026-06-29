import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarMode = "expanded" | "collapsed";

interface SidebarState {
  mode: SidebarMode;
  isMobileOpen: boolean;
  toggleSidebar: () => void;
  setMode: (mode: SidebarMode) => void;
  setMobileOpen: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      mode: "expanded",
      isMobileOpen: false,
      toggleSidebar: () => {
        const { mode } = get();
        set({ mode: mode === "expanded" ? "collapsed" : "expanded" });
      },
      setMode: (mode) => set({ mode }),
      setMobileOpen: (open) => set({ isMobileOpen: open }),
    }),
    { name: "clinic-admin-sidebar" },
  ),
);
