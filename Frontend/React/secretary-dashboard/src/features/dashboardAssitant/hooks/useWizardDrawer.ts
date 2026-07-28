import { create } from "zustand";
import type { PendingRequest, AppointmentType } from "../types";

interface Type {
  isWizardOpen: boolean;
  onClose: () => void;
  onOpenNewAppointment: (initData?: {
    doctorId: string;
    timeSlot: number;
    duration: number;
    date: Date;
  }) => void;
  pendingRequestData: PendingRequest | null;
  openWithPendingRequest: (request: PendingRequest) => void;
  initialData: {
    doctorId: string;
    timeSlot: number;
    duration: number;
    date: Date;
  } | null;
  
  // دمج أوضاع التعديل والقراءة فقط
  editingAppointment: AppointmentType | null;
  viewOnlyMode: boolean;
  openWithEditAppointment: (appointment: AppointmentType, viewOnly?: boolean) => void;
}

export const useWizardDrawer = create<Type>((set) => ({
  isWizardOpen: false,
  initialData: null,
  pendingRequestData: null,
  editingAppointment: null,
  viewOnlyMode: false,
  
  onClose: () =>
    set({ 
      isWizardOpen: false, 
      initialData: null, 
      pendingRequestData: null, 
      editingAppointment: null,
      viewOnlyMode: false 
    }),
    
  onOpenNewAppointment: (initData) =>
    set({
      isWizardOpen: true,
      initialData: initData || null,
      pendingRequestData: null,
      editingAppointment: null,
      viewOnlyMode: false,
    }),
    
  openWithPendingRequest: (request) =>
    set({ 
      isWizardOpen: true, 
      pendingRequestData: request, 
      initialData: null, 
      editingAppointment: null,
      viewOnlyMode: false 
    }),

  openWithEditAppointment: (appointment, viewOnly = false) =>
    set({
      isWizardOpen: true,
      editingAppointment: appointment,
      viewOnlyMode: viewOnly,
      initialData: null,
      pendingRequestData: null,
    }),
}));