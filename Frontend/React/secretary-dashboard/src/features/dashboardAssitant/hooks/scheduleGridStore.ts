import { create } from "zustand";
import type { DoctorWithAppointments } from "./useScheduleData";
import {
  DEFAULT_SCHEDULE_FILTERS,
  type ScheduleFilters,
  type FilterPresetId,
  FILTER_PRESETS,
} from "../utils/scheduleFilters";
import type { AppointmentDisplayStatus } from "../utils/appointmentStatusStyles";
import type { ComplexityType } from "../CreateAppointmentWizard/useAppointmentWizard";

interface ScheduleGridStore {
  doctors: DoctorWithAppointments[];
  filters: ScheduleFilters;
  filterPanelOpen: boolean;
  /** @deprecated use filters.query — kept for gradual callers */
  searchQuery: string;
  setDoctors: (doctors: DoctorWithAppointments[]) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (patch: Partial<ScheduleFilters>) => void;
  toggleStatus: (status: AppointmentDisplayStatus) => void;
  toggleDoctor: (doctorId: string) => void;
  toggleComplexity: (complexity: ComplexityType) => void;
  applyPreset: (id: FilterPresetId) => void;
  resetFilters: () => void;
  setFilterPanelOpen: (open: boolean) => void;
}

export const useScheduleGridStore = create<ScheduleGridStore>((set, get) => ({
  doctors: [],
  filters: { ...DEFAULT_SCHEDULE_FILTERS },
  filterPanelOpen: false,
  searchQuery: "",
  setDoctors: (doctors) => set({ doctors }),
  setSearchQuery: (query) =>
    set((state) => ({
      searchQuery: query,
      filters: { ...state.filters, query },
    })),
  setFilters: (patch) =>
    set((state) => {
      const filters = { ...state.filters, ...patch };
      return {
        filters,
        searchQuery: filters.query,
      };
    }),
  toggleStatus: (status) => {
    const { filters } = get();
    const exists = filters.statuses.includes(status);
    const statuses = exists
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    set({ filters: { ...filters, statuses } });
  },
  toggleDoctor: (doctorId) => {
    const { filters } = get();
    const exists = filters.doctorIds.includes(doctorId);
    const doctorIds = exists
      ? filters.doctorIds.filter((id) => id !== doctorId)
      : [...filters.doctorIds, doctorId];
    set({ filters: { ...filters, doctorIds } });
  },
  toggleComplexity: (complexity) => {
    const { filters } = get();
    const exists = filters.complexities.includes(complexity);
    const complexities = exists
      ? filters.complexities.filter((c) => c !== complexity)
      : [...filters.complexities, complexity];
    set({ filters: { ...filters, complexities } });
  },
  applyPreset: (id) => {
    const preset = FILTER_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const filters = preset.apply(get().filters);
    set({ filters, searchQuery: filters.query, filterPanelOpen: true });
  },
  resetFilters: () =>
    set({
      filters: { ...DEFAULT_SCHEDULE_FILTERS },
      searchQuery: "",
    }),
  setFilterPanelOpen: (filterPanelOpen) => set({ filterPanelOpen }),
}));
