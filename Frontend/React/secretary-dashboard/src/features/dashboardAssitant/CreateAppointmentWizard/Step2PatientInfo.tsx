import { useState, useRef, useEffect } from "react";
import { Search, Phone, MapPin, AlertCircle, CheckCircle2 } from "lucide-react";
import type { PatientProfile, WizardFormData } from "./useAppointmentWizard";

interface Step2PatientInfoProps {
  formData: WizardFormData;
  handleFieldChange: <K extends keyof WizardFormData>(
    field: K,
    value: WizardFormData[K],
  ) => void;
  setSearchQuery: (val: string) => void;
  filteredPatients: PatientProfile[];
  selectPatientFromSearch: (patient: PatientProfile) => void;
  step2Errors: {
    nameEmpty: boolean;
    ageInvalid: boolean;
    genderEmpty: boolean;
    phoneEmpty: boolean;
    phoneInvalid: boolean;
  };
  isDuplicatePhone: boolean;
  viewOnlyMode?: boolean;
}

export function Step2PatientInfo({
  formData,
  handleFieldChange,
  setSearchQuery,
  filteredPatients,
  selectPatientFromSearch,
  step2Errors,
  isDuplicatePhone,
  viewOnlyMode = false,
}: Step2PatientInfoProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close drop list on external blur clicks
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation controls inside autocomplete results list
  const handleAutocompleteKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filteredPatients.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < filteredPatients.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : filteredPatients.length - 1,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredPatients.length) {
        selectPatientFromSearch(filteredPatients[activeIndex]);
        setShowDropdown(false);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div className="space-y-4 select-none animate-in fade-in duration-200">
      {/* 1. Patient Name Autocomplete Field */}
      <div className="relative" ref={dropdownRef}>
        <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wide">
          Patient Name *
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            disabled={viewOnlyMode}
            value={formData.patientName}
            onChange={(e) => {
              handleFieldChange("patientName", e.target.value);
              setSearchQuery(e.target.value);
              if (formData.isExistingPatient)
                handleFieldChange("isExistingPatient", false);
              setShowDropdown(true);
              setActiveIndex(-1);
            }}
            onKeyDown={handleAutocompleteKeyDown}
            onFocus={() => setShowDropdown(true)}
            placeholder="Patient name..."
            className={`w-full bg-white border rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-medium outline-none transition-colors ${
              formData.patientName && step2Errors.nameEmpty
                ? "border-red-300"
                : "border-neutral-200 focus:border-neutral-300"
            }`}
          />
          <Search className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
        </div>

        {/* Floating Suggestion Panel */}
        {showDropdown && filteredPatients.length > 0 && !viewOnlyMode && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-neutral-200 shadow-xl rounded-xl p-1 z-50 max-h-48 overflow-y-auto">
            {filteredPatients.map((patient, idx) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => {
                  selectPatientFromSearch(patient);
                  setShowDropdown(false);
                }}
                className={`w-full text-right px-3.5 py-2 text-xs font-medium rounded-lg flex items-center justify-between transition-colors ${
                  idx === activeIndex
                    ? "bg-blue-50 text-blue-600 font-bold"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <span className="text-[10px] text-neutral-400 font-mono">
                  {patient.phone}
                </span>
                <span className="font-semibold">{patient.name}</span>
              </button>
            ))}
          </div>
        )}
        {formData.isExistingPatient && (
          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100/60 px-2 py-0.5 rounded-md font-bold mt-1.5 inline-flex items-center gap-1">
            Existing Profile Linked{" "}
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          </span>
        )}
      </div>

      {/* 2. Age & Gender Layout Row split wrapper */}
      <div className="grid grid-cols-2 gap-3">
        {/* Gender Selection Grid */}

        {/* Numerical Age Field */}
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wide">
            Age *
          </label>
          <input
            type="number"
            disabled={viewOnlyMode}
            min="0"
            max="99"
            value={formData.patientAge}
            onChange={(e) => handleFieldChange("patientAge", e.target.value)}
            placeholder="Enter patient age"
            className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none text-right transition-colors ${
              formData.patientAge && step2Errors.ageInvalid
                ? "border-red-400 bg-red-50/10"
                : "border-neutral-200 focus:border-neutral-300"
            }`}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wide">
            Gender *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {["Male", "Female"].map((g) => (
              <button
                disabled={viewOnlyMode}
                key={g}
                type="button"
                onClick={() =>
                  handleFieldChange(
                    "patientGender",
                    g as "Male" | "Female" | null,
                  )
                }
                className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  formData.patientGender === g
                    ? "border-blue-500 bg-blue-50/20 text-blue-600 shadow-xs"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <span
                  className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${formData.patientGender === g ? "border-blue-500" : "border-neutral-300"}`}
                >
                  {formData.patientGender === g && (
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                </span>
                <span>{g}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Phone Field with Conflict Warning Notice */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wide">
          Phone Number *
        </label>
        <div className="relative flex items-center">
          <input
            disabled={viewOnlyMode}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={formData.patientPhone}
            onChange={(e) => handleFieldChange("patientPhone", e.target.value)}
            placeholder="09… or +963…"
            className={`w-full bg-white border rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-medium outline-none text-left transition-colors ${
              isDuplicatePhone
                ? "border-violet-400 bg-violet-50/10 focus:border-violet-400"
                : step2Errors.phoneInvalid ||
                    (formData.patientPhone && step2Errors.phoneEmpty)
                  ? "border-red-400 bg-red-50/10"
                  : "border-neutral-200 focus:border-neutral-300"
            }`}
          />
          <Phone className="w-4 h-4 text-neutral-400 absolute right-3.5 pointer-events-none" />
        </div>
        {step2Errors.phoneInvalid && (
          <p className="text-[10px] font-bold text-red-600 mt-1.5">
            Enter a valid Syrian number (09XXXXXXXX or +963XXXXXXXXX). Letters are not allowed.
          </p>
        )}
        {isDuplicatePhone && (
          <div className="flex items-center justify-end gap-1.5 text-violet-700 text-[10px] font-bold mt-1.5 bg-violet-50 border border-violet-200/50 p-2 rounded-lg animate-in fade-in duration-150">
            <span>A patient with this phone number already exists. You can still continue or book manually.</span>
            <AlertCircle className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          </div>
        )}
      </div>

      {/* 4. Textarea Address Node with Reactive Live Counters */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-neutral-400 font-mono">
            {formData.patientAddress.length} / 200
          </span>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide">
            Address (Optional)
          </label>
        </div>
        <div className="relative flex items-start">
          <textarea
            maxLength={200}
            disabled={viewOnlyMode}
            value={formData.patientAddress}
            onChange={(e) =>
              handleFieldChange("patientAddress", e.target.value)
            }
            placeholder="Type patient address..."
            className="w-full min-h-[72px] max-h-[72px] bg-white border border-neutral-200 rounded-xl pl-3.5 pr-10 py-2 text-xs font-medium outline-none  focus:border-neutral-300 transition-colors resize-none"
          />
          <MapPin className="w-4 h-4 text-neutral-400 absolute right-3.5 top-2.5 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
