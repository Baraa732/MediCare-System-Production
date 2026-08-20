import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import {
  TREATMENT_OPTIONS,
  // useAppointmentWizard,
  type ComplexityType,
  type WizardFormData,
} from "./useAppointmentWizard";
import { formatMinutesToAMPM } from "../components/SchedualeGrid/DNDGrid/utils/timeFormatters";
import type { AppointmentType, DoctorType } from "../types";
import { Calendar } from "@/components/ui/calendar";
import { useWizardDrawer } from "../hooks/useWizardDrawer";

export interface availableDoctorsFilteredType {
  appointmentsTodayCount: number;
  isAvailableAtSlot: boolean;
  isAvailable: boolean;
  id: string;
  name: string;
  specialty?: string;
  patients?: number;
  avatar?: string;
  appointments?: AppointmentType[];
  columnAppointments?: AppointmentType[];
}
interface Step1TreatmentInfoType {
  formData: WizardFormData;
  availableTimeSlots: number[];
  availableDoctorsFiltered: availableDoctorsFilteredType[];
  doctors: DoctorType[];
  searchTreatment: string;
  setSearchTreatment: (e: string) => void;
  handleFieldChange: <K extends keyof WizardFormData>(
    field: K,
    value: WizardFormData[K],
  ) => void;
  viewOnlyMode?: boolean;
}

export function Step1TreatmentInfo({
  formData,
  availableTimeSlots,
  availableDoctorsFiltered,
  doctors,
  searchTreatment,
  setSearchTreatment,
  handleFieldChange,
  viewOnlyMode = false,
}: Step1TreatmentInfoType) {
  const editingAppointment = useWizardDrawer(
    (state) => state.editingAppointment,
  );
  // eslint-disable-next-line react-hooks/purity
  const now: number = useMemo(() => Date.now(), []);

  const [showTreatDropdown, setShowTreatDropdown] = useState(false);
  const [showDocDropdown, setShowDocDropdown] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // const handleDateSelect = (day: number) => {
  //   const date = new Date(day);
  //   handleFieldChange("date", date);
  // };

  const filteredTreatments = useMemo(() => {
    return TREATMENT_OPTIONS.filter((t) =>
      t.name.toLowerCase().includes(searchTreatment.toLowerCase()),
    );
  }, [searchTreatment]);

  useEffect(() => {
    if (!formData.date || formData.timeSlot == null) return;
    const now = new Date();
    const selected = new Date(formData.date);
    const isToday = selected.toDateString() === now.toDateString();
    if (
      isToday &&
      formData.timeSlot <= now.getHours() * 60 + now.getMinutes()
    ) {
      handleFieldChange("timeSlot", null);
    }
  }, [formData.date, formData.timeSlot]);
  const selectedTreatment = useMemo(
    () =>
      TREATMENT_OPTIONS.find((t) => {
        // console.log(formData.treatmentId);
        return t.id === formData.treatmentId;
      }),
    [formData.treatmentId],
  );
  return (
    <div className="space-y-5  select-none animate-in fade-in duration-200">
      {/* 1. Treatment Dropdown Slot */}
      <div className="relative">
        <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wide">
          Select Treatment *
        </label>
        <button
          type="button"
          disabled={viewOnlyMode}
          onClick={() => {
            console.log(selectedTreatment?.name);
            return (
              !viewOnlyMode &&
              setShowTreatDropdown((prev) => {
                if (!prev) {
                  setShowCalendar(false);
                  setShowDocDropdown(false);
                }
                return !prev;
              })
            );
          }}
          className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-neutral-800 flex items-center justify-between shadow-xs hover:border-neutral-300 transition-colors"
        >
          {!viewOnlyMode && (
            <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
          )}
          <span>
            {selectedTreatment
              ? selectedTreatment?.name
              : "Choose treatment option..."}
          </span>
        </button>

        {showTreatDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-neutral-200 shadow-xl rounded-xl p-1.5 z-50 animate-in slide-in-from-top-1 duration-100">
            <div className="flex items-center gap-2 border border-neutral-100 bg-neutral-50/50 rounded-lg px-2.5 py-1.5 mb-1">
              <Search className="w-3.5 h-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search treatments..."
                value={searchTreatment}
                onChange={(e) => setSearchTreatment(e.target.value)}
                className="w-full bg-transparent text-xs border-none outline-none text-right"
              />
            </div>
            <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-0.5">
              {filteredTreatments.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    handleFieldChange("treatmentId", t.id);
                    // handleDurationChange(t.baseDuration);
                    setShowTreatDropdown(false);
                  }}
                  className="w-full text-right px-3 py-2 text-xs font-medium rounded-lg text-neutral-700 hover:bg-neutral-50 flex items-center justify-between"
                >
                  <span>{t.name}</span>
                  <span className="text-[10px] text-neutral-400">
                    {t.baseDuration} min | {t.basePrice.toLocaleString()} SYP
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* 2. Complexity Radio Choice Rows */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wide">
          Complexity Class *
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(
            ["standard", "complex", "elderly", "urgent"] as ComplexityType[]
          ).map((tier) => (
            <label
              key={tier}
              className={`border rounded-xl p-3 flex flex-col justify-center items-start cursor-pointer transition-all ${
                formData.complexity === tier
                  ? "border-blue-500 bg-blue-50/30 text-blue-600 shadow-xs"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <input
                disabled={viewOnlyMode}
                type="radio"
                name="complexity"
                value={tier}
                checked={formData.complexity === tier}
                onChange={() => handleFieldChange("complexity", tier)}
                className="hidden"
              />
              <span className="text-xs font-bold capitalize">{tier}</span>
            </label>
          ))}
        </div>
      </div>
      {/* 3. High Precision Day-Count Validated Calendar Grid */}
      <div className="relative">
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5">
          Appointment Date
        </label>
        <button
          disabled={viewOnlyMode}
          onClick={() => !viewOnlyMode && setShowCalendar((prev) => {
                if (!prev) {
                  setShowTreatDropdown(false);
                  setShowDocDropdown(false);
                }
                return !prev;
              })}
          className="w-full h-11 bg-white border border-neutral-200 rounded-xl px-4 flex items-center justify-between text-xs font-semibold text-neutral-700 disabled:bg-neutral-50 disabled:text-neutral-400 cursor-pointer"
        >
          {!viewOnlyMode && (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
          <span>
            {formData.date ? formData.date.toDateString() : "Select date..."}
          </span>
        </button>

        {showCalendar && (
          <div className="absolute top-[102%] right-0 left-0 z-[100] bg-white border border-neutral-100 rounded-2xl shadow-xl p-3 flex justify-center">
            <Calendar
              mode="single"
              disabled={{ before: new Date() }}
              selected={formData.date}
              onSelect={(day) => {
                if (day) {
                  handleFieldChange("date", day);
                  setShowCalendar(false);
                }
              }}
              defaultMonth={new Date(formData.date ?? now)}
              captionLayout="label"
              className="border-none shadow-none w-full"
            />
          </div>
        )}
      </div>
      {/* 4. Filtered Time Selector Node */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wide">
          Available Start Time *
          <p className="text-blue-500 animate-pulse">Start Time : {formatMinutesToAMPM(formData.timeSlot!)}</p>
        </label>
        {availableTimeSlots.length === 0 ? (
          <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 text-center">
            <p className="text-xs font-semibold text-amber-800">
              No available time slots.
            </p>
            <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
              Please modify your selected date parameters.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
            {!viewOnlyMode ? (
              availableTimeSlots.map((minutesSlot: number) => {
                const isSelected = formData.timeSlot === minutesSlot;
                return (
                  <button
                    key={minutesSlot}
                    type="button"
                    onClick={() => handleFieldChange("timeSlot", minutesSlot)}
                    className={`py-1.5 rounded-lg border text-xs font-bold transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/50 text-blue-600"
                        : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {formatMinutesToAMPM(minutesSlot)}
                  </button>
                );
              })
            ) : (
              <label
                key={formData.timeSlot}
                className={`py-1.5 rounded-lg border text-xs font-bold transition-all "border-blue-500 bg-blue-50/50 text-blue-600"`}
              >
                {formatMinutesToAMPM(formData.timeSlot!)}
              </label>
            )}
          </div>
        )}
      </div>
      {/* // داخل مكون Step1TreatmentInfo */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-2">
          Appointment Duration (Minutes)
        </label>
        <div className="flex items-center gap-2">
          {!viewOnlyMode && (
            <button
              onClick={() =>
                handleFieldChange(
                  "duration",
                  Math.max(15, formData.duration - 15),
                )
              }
              className="px-3 py-1 bg-neutral-100 rounded-lg"
            >
              -
            </button>
          )}
          <span className="font-mono text-sm font-bold">
            {formData.duration} min
          </span>
          {!viewOnlyMode && (
            <button
              onClick={() =>
                handleFieldChange("duration", formData.duration + 15)
              }
              className="px-3 py-1 bg-neutral-100 rounded-lg"
            >
              +
            </button>
          )}
        </div>
      </div>
      {/* 5. Deduplicated Doctor Selection */}
      <div className="relative">
        <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wide">
          Assign Available Doctor *
        </label>
        <button
          type="button"
          disabled={formData.timeSlot === null}
          onClick={() => !viewOnlyMode && setShowDocDropdown((prev) => {
                if (!prev) {
                  setShowCalendar(false);
                  setShowTreatDropdown(false);
                }
                return !prev;
              })}
          className="w-full bg-white border border-neutral-200 disabled:bg-neutral-50/70 disabled:opacity-60 rounded-xl px-3.5 py-2.5 text-xs font-medium text-neutral-800 flex items-center justify-between shadow-xs"
        >
          <span>
            {viewOnlyMode || editingAppointment
              ? doctors.find((d) => d.id === formData.doctorId)?.name
              : formData.doctorId
                ? availableDoctorsFiltered.find(
                    (d) => d.id === formData.doctorId,
                  )?.name
                : "Choose dynamic provider..."}
          </span>
          {!viewOnlyMode && (
            <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
          )}
        </button>

        {showDocDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-neutral-200 shadow-xl rounded-xl p-1.5 z-50 animate-in slide-in-from-top-1 duration-100">
            {availableDoctorsFiltered.length === 0 ? (
              <p className="text-xs font-medium text-neutral-400 text-center py-3">
                No available doctors for the selected time.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto scrollbar-thin space-y-0.5">
                {availableDoctorsFiltered.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      handleFieldChange("doctorId", doc.id);
                      setShowDocDropdown(false);
                    }}
                    className="w-full text-right px-3 py-2 text-xs font-medium rounded-lg text-neutral-700 hover:bg-neutral-50 flex items-center justify-between"
                  >
                    <div className="w-7 h-7 rounded-full bg-neutral-100 overflow-hidden shrink-0">
                      {doc.avatar ? (
                        <img
                          src={doc.avatar}
                          alt={doc.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-neutral-200" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{doc.name}</span>
                      <div className="w-5 h-5 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[10px] text-neutral-500 font-bold">
                        {doc.name.charAt(0)}
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md font-bold">
                      {doc.appointmentsTodayCount} appointments today
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* 6. Restrict Checkbox Widget */}
      <label className="flex items-center justify-end gap-2 cursor-pointer select-none py-1">
        <span className="text-xs font-semibold text-neutral-600">
          Restrict to this doctor only
        </span>
        <input
          disabled={viewOnlyMode}
          type="checkbox"
          checked={formData.isLockedToDoctor}
          onChange={(e) =>
            handleFieldChange("isLockedToDoctor", e.target.checked)
          }
          className="w-3.5 h-3.5 text-blue-600 border-neutral-300 rounded focus:ring-blue-500"
        />
      </label>
      {/* 7. Notes Textarea Frame with Active Live Character Counter */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide">
            Internal Notes (Optional)
          </label>
          <span className="text-[11px] font-bold text-neutral-400">
            {formData.notes.length} / 200
          </span>
        </div>
        <textarea
          disabled={viewOnlyMode}
          maxLength={200}
          value={formData.notes}
          onChange={(e) => handleFieldChange("notes", e.target.value)}
          placeholder="Enter internal diagnostic flags or special requests..."
          className="w-full min-h-[64px] max-h-[64px] bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-medium outline-none  focus:border-neutral-300 transition-colors resize-none placeholder:text-neutral-300"
        />
      </div>
    </div>
  );
}
