import { useCallback, useEffect, useState } from "react";
import {  HelpCircle, X } from "lucide-react";
import {
  useAppointmentWizard,
  type WizardFormData,
} from "./useAppointmentWizard";
import { Step1TreatmentInfo } from "./Step1TreatmentInfo";
import { Step2PatientInfo } from "./Step2PatientInfo";
import { Step3ReviewSummary } from "./Step3ReviewSummary";

import { useWizardDrawer } from "../hooks/useWizardDrawer";
import StepperCustome from "./StepperCustome";
import type { DoctorType } from "../types";
import { usePendingRequest } from "../hooks/usePendingRequest";
import { useAppointmentActions } from "../hooks/useAppointmentActions";
import { normalizeCaughtError } from "@/lib/api/errors";

// استيراد المكونات السلسة والآمنة من shadcn/ui
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
interface AppointmentWizardDrawerProps {
  doctors: DoctorType[];
}

export function AppointmentWizardDrawer({
  doctors,
}: AppointmentWizardDrawerProps) {
  const viewOnlyMode = useWizardDrawer((state) => state.viewOnlyMode);
  const isWizardOpen = useWizardDrawer((state) => state.isWizardOpen);
  const onClose = useWizardDrawer((state) => state.onClose);
  const pendingRequestData = useWizardDrawer(
    (state) => state.pendingRequestData,
  ); // جلب بيانات الطلب النشط حالياً إن وجدت
  const editingAppointment = useWizardDrawer(
    (state) => state.editingAppointment,
  );
  
  // بوب آب تحذير الخروج وتأكيد الموعد المستعجل
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const onRemovePendingRequest = usePendingRequest(
    (state) => state.onRemovePendingRequest,
  );
  const { saveWizardAppointment } = useAppointmentActions();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAppointment = useCallback(
    async (wizardData?: WizardFormData) => {
      if (!wizardData) return null;
      setSaveError(null);
      setIsSaving(true);

      try {
        await saveWizardAppointment(wizardData, {
          editingId: editingAppointment?.id,
          pendingRequestId: pendingRequestData?.id,
        });

        if (pendingRequestData) {
          onRemovePendingRequest(pendingRequestData.id);
        }

        onClose();
      } catch (err) {
        setSaveError(
          normalizeCaughtError(
            err,
            "Could not save the appointment. Please try again.",
          ),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [
      editingAppointment?.id,
      onClose,
      onRemovePendingRequest,
      pendingRequestData,
      saveWizardAppointment,
    ],
  );

  // نمرر الدالة الوسيطة handleSaveAppointment هنا بدلاً من onExecuteCreation المباشرة
  const wizard = useAppointmentWizard(doctors, handleSaveAppointment, onClose);
  // ...
  // Keyboard Navigation Bindings Rule
  useEffect(() => {
    if (!isWizardOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape")
        // handleSaveAppointment(wizard as unknown as WizardFormData);
        onClose();
      if (e.key === "Enter" && wizard.currentStep === 3)
        wizard.handleFinalSubmit();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveAppointment, isWizardOpen, onClose, wizard]);
  const handleAttemptClose = () => {
    if (wizard.isDirty && !viewOnlyMode) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };
  if (!isWizardOpen) return null;

  return (
    <>
      {/* ⚠️ 2. بوب آب تأكيد إلغاء التغييرات لحماية البيانات */}
      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogPortal>
          <DialogOverlay className=" bg-black/60 backdrop-blur-xs" />
          <DialogContent
            className="fixed z-100 max-w-sm w-full rounded-2xl p-5 border border-neutral-100 shadow-2xl bg-white"
          >
            <DialogHeader className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                <HelpCircle className="w-6 h-6" />
              </div>
              <DialogTitle className="text-sm font-black text-neutral-900">
                Discard unsaved changes?
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500 leading-relaxed">
                You have unsaved appointment details. Closing now will lose your
                changes.
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onClose();
                }}
                className="flex-1 h-10 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 h-10 text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-all cursor-pointer"
              >
                Keep editing
              </button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <div className="fixed inset-0 z-[70] flex justify-end">
        <div
          onClick={handleAttemptClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-all"
        />

        {/* Primary Control Base Plate Container */}
        <div className="relative w-[28.5%] h-[95.5%] bg-white border-l border-neutral-200/80 shadow-[0_0_50px_rgba(0,0,0,0.15)] flex flex-col justify-between z-10 transition-all duration-1000 ease-in-out m-[24px] rounded-2xl">
          {/* Header Block Section */}
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
            <button
              onClick={handleAttemptClose}
              className="p-1 rounded-lg text-neutral-400 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-neutral-800">
              {viewOnlyMode
                ? "Info Appointment"
                : editingAppointment
                  ? "Update Appointment"
                  : "Create Appointment"}
            </h3>
            {/* {viewOnlyMode ? "وضع القراءة فقط" : "استمارة الجدولة التفاعلية"} */}
          </div>
          {/* Unified 3-Step Stepper Display Track from image_319dc7.png */}
          {/* Dynamic State-Driven Stepper Track (Green = Completed, Blue = Active, Gray = Pending) */}
          <StepperCustome wizard={wizard} />

          {/* Middle Scrollable Layout Body Panel */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-neutral-200">
            {saveError ? (
              <p className="mb-4 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {saveError}
              </p>
            ) : null}
            {wizard.currentStep === 1 && <Step1TreatmentInfo {...wizard} />}
            {wizard.currentStep === 2 && <Step2PatientInfo {...wizard} />}
            {wizard.currentStep === 3 && <Step3ReviewSummary {...wizard} />}
          </div>
          {/* Footer Trailing Step Controllers Tray */}
          <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between shrink-0">
            {wizard.currentStep === 1 ? (
              <button
                onClick={handleAttemptClose}
                className="px-4 py-2 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={wizard.handleBack}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-all cursor-pointer"
              >
                Back
              </button>
            )}

            {wizard.currentStep == 1 ||
            (wizard.currentStep == 2 && !viewOnlyMode) ? (
              <button
                onClick={wizard.handleNext}
                disabled={
                  editingAppointment
                    ? false
                    : viewOnlyMode
                      ? false
                      : wizard.currentStep === 1
                        ? !wizard.isStep1Valid
                        : !wizard.isStep2Valid
                }
                className="px-5 py-2 text-xs font-bold bg-[#0066ff] hover:bg-blue-600 text-white shadow-sm disabled:opacity-40 disabled:pointer-events-none rounded-xl transition-all active:scale-[0.99] cursor-pointer"
              >
                Next
              </button>
            ) : (
              !viewOnlyMode && (
                <button
                  onClick={wizard.handleFinalSubmit}
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm rounded-xl transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {isSaving
                    ? "Saving..."
                    : editingAppointment
                      ? "Update Appointment"
                      : "Create Appointment"}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
