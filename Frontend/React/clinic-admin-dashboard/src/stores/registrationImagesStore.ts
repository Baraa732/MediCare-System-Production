import { create } from "zustand";

interface RegistrationImagesState {
  profileImage: File | null;
  clinicImage: File | null;
  setProfileImage: (file: File | null) => void;
  setClinicImage: (file: File | null) => void;
  clear: () => void;
}

export const useRegistrationImagesStore = create<RegistrationImagesState>()(
  (set) => ({
    profileImage: null,
    clinicImage: null,
    setProfileImage: (profileImage) => set({ profileImage }),
    setClinicImage: (clinicImage) => set({ clinicImage }),
    clear: () => set({ profileImage: null, clinicImage: null }),
  }),
);
