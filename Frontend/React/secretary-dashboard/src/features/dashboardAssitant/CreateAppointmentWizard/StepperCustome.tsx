import type { useAppointmentWizard } from "./useAppointmentWizard";

export default function StepperCustome({wizard} : {wizard:ReturnType<typeof useAppointmentWizard>}) {
  return (
    <div className="px-6 py-5 bg-white border-b border-neutral-100 shrink-0 select-none">
      <div className="flex items-center justify-between w-full max-w-sm mx-auto">
        {/* STEP 1: Treatment Info */}
        <div className="flex flex-col items-center flex-1">
          {wizard.currentStep > 1 ? (
            // Completed State (Green)
            <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xs animate-in scale-in duration-200">
              <svg
                className="w-4 h-4 stroke-[3]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          ) : wizard.currentStep === 1 ? (
            // Active State (Blue with Dashed Ring)
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-blue-500 flex items-center justify-center p-0.5 animate-in fade-in duration-300">
              <div className="w-full h-full rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              </div>
            </div>
          ) : (
            // Pending State (Gray)
            <div className="w-9 h-9 rounded-full border-2 border-neutral-200 bg-white flex items-center justify-center text-neutral-400">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
          )}
          <div className="text-center mt-2">
            <span className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
              Step 1
            </span>
            <span
              className={`block text-xs font-bold mt-0.5 ${wizard.currentStep === 1 ? "text-blue-600" : wizard.currentStep > 1 ? "text-emerald-600" : "text-neutral-400"}`}
            >
              Treatment info
            </span>
          </div>
        </div>

        {/* LINE 1 -> 2: Green if Step 1 is done, otherwise Gray */}
        <div
          className={`flex-1 h-[2px] -mt-15 mx-2 transition-colors duration-300 ${wizard.currentStep > 1 ? "bg-emerald-500" : "bg-neutral-200"}`}
        />

        {/* STEP 2: Patient Info */}
        <div className="flex flex-col items-center flex-1">
          {wizard.currentStep > 2 ? (
            // Completed State (Green)
            <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xs animate-in scale-in duration-200">
              <svg
                className="w-4 h-4 stroke-[3]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          ) : wizard.currentStep === 2 ? (
            // Active State (Blue with Dashed Ring)
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-blue-500 flex items-center justify-center p-0.5 animate-in fade-in duration-300">
              <div className="w-full h-full rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            </div>
          ) : (
            // Pending State (Gray)
            <div className="w-9 h-9 rounded-full border-2 border-neutral-200 bg-white flex items-center justify-center text-neutral-400">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          )}
          <div className="text-center mt-2">
            <span className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
              Step 2
            </span>
            <span
              className={`block text-xs font-bold mt-0.5 ${wizard.currentStep === 2 ? "text-blue-600" : wizard.currentStep > 2 ? "text-emerald-600" : "text-neutral-400"}`}
            >
              Patient info
            </span>
          </div>
        </div>

        {/* LINE 2 -> 3: Green if Step 2 is done, otherwise Gray */}
        <div
          className={`flex-1 h-[2px] -mt-15 mx-2 transition-colors duration-300 ${wizard.currentStep > 2 ? "bg-emerald-500" : "bg-neutral-200"}`}
        />

        {/* STEP 3: Confirmation Summary */}
        <div className="flex flex-col items-center justify-start flex-1">
          {wizard.currentStep === 3 ? (
            // Active State (Blue with Dashed Ring)
            <div className="w-10   h-10 rounded-full border-2 border-dashed border-blue-500 flex items-center justify-center p-0.5 animate-in fade-in duration-300">
              <div className="w-full h-full rounded-full bg-blue-600 flex items-center justify-center text-white shadow-xs">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
          ) : (
            // Pending State (Gray)
            <div className="w-9 h-9 rounded-full border-2 border-neutral-200 bg-white flex items-center justify-center text-neutral-400">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          )}
          <div className="text-center mt-2">
            <span className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
              Step 3
            </span>
            <span
              className={`block text-xs font-bold mt-0.5 ${wizard.currentStep === 3 ? "text-blue-600" : "text-neutral-400"}`}
            >
              Confirmation
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
