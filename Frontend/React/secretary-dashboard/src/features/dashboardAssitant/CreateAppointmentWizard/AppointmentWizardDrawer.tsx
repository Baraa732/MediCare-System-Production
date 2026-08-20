import { useCallback, useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
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
  DialogTitle,
  DialogDescription,
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
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[100]"
          className="z-[110] max-w-sm rounded-2xl border border-neutral-200/80 bg-white p-0 shadow-2xl"
        >
            <div className="border-b border-neutral-100 px-5 py-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                <HelpCircle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-bold text-neutral-900">
                Discard unsaved changes?
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-relaxed text-neutral-500">
                You have unsaved appointment details. Closing now will lose your
                changes.
              </DialogDescription>
            </div>

            <div className="flex gap-2 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="btn-brand h-10 flex-1 rounded-xl border-0 text-xs font-bold"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  onClose();
                }}
                className="h-10 flex-1 rounded-xl border border-neutral-200 bg-white text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Discard
              </button>
            </div>
        </DialogContent>
      </Dialog>

      <div className="fixed inset-0 z-[70] flex justify-end">
        <div
          onClick={handleAttemptClose}
          className="overlay-backdrop absolute inset-0"
        />

        <div className="panel-slide-right relative z-10 m-6 flex h-[95.5%] w-[min(28.5vw,420px)] flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white/95 shadow-[0_0_50px_rgba(0,0,0,0.15)] backdrop-blur-md">
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
                className="px-5 py-2 text-xs font-bold btn-brand rounded-xl disabled:pointer-events-none disabled:opacity-40"
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
