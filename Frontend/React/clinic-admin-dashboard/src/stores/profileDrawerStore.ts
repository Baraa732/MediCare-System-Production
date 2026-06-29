import { create } from "zustand";

type ProfileDrawerTab = "profile" | "security";

type ProfileDrawerState = {
  isOpen: boolean;
  activeTab: ProfileDrawerTab;
  open: (tab?: ProfileDrawerTab) => void;
  close: () => void;
  setTab: (tab: ProfileDrawerTab) => void;
};

export const useProfileDrawerStore = create<ProfileDrawerState>((set) => ({
  isOpen: false,
  activeTab: "profile",
  open: (tab = "profile") => set({ isOpen: true, activeTab: tab }),
  close: () => set({ isOpen: false }),
  setTab: (tab) => set({ activeTab: tab }),
}));
