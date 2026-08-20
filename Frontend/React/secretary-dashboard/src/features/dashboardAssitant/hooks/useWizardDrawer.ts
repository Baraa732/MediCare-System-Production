import { create } from "zustand";
import type { PendingRequest, AppointmentType } from "../types";
import { absoluteMinutesFromGridMinutes } from "@/lib/time/gridTime";

interface Type {
  isWizardOpen: boolean;
  onClose: () => void;
  onOpenNewAppointment: (initData?: {
    doctorId: string;
    doctorName?: string;
    timeSlot: number;
    duration: number;
    date: Date;
    startSlot?: number;
    endSlot?: number;
    fromGridSelection?: boolean;
  }) => void;
  pendingRequestData: PendingRequest | null;
  openWithPendingRequest: (request: PendingRequest) => void;
  openWithPendingRequestAtSlot: (
    request: PendingRequest,
    date: Date,
  ) => void;
  initialData: {
    doctorId: string;
    doctorName?: string;
    timeSlot: number;
    duration: number;
    date: Date;
    startSlot?: number;
    endSlot?: number;
    fromGridSelection?: boolean;
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

  openWithPendingRequestAtSlot: (request, date) =>
    set({
      isWizardOpen: true,
      pendingRequestData: request,
      initialData: {
        doctorId: request.docId,
        timeSlot: absoluteMinutesFromGridMinutes(request.start),
        duration: request.end - request.start || request.duration || 30,
        date,
        fromGridSelection: true,
      },
      editingAppointment: null,
      viewOnlyMode: false,
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