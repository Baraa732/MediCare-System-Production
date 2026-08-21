import { useState, useMemo, useEffect, useRef } from "react";
import type { DoctorType } from "@/features/dashboardAssitant/types";
import { useWizardDrawer } from "../hooks/useWizardDrawer";
import { START_TIME_MINUTES } from "../data/scheduleGrid";
import { absoluteMinutesFromGridMinutes } from "@/lib/time/gridTime";
import { formatMinutesToAMPM } from "../components/SchedualeGrid/DNDGrid/utils/timeFormatters";
import { lookupPatientByPhone } from "@/lib/api/users";
import { useAuthStore } from "@/stores/authStore";
import { listAvailableSlots } from "@/lib/api/schedule";
import { absoluteMinutesFromIso } from "@/lib/time/gridTime";
import { useScheduleContext } from "../context/ScheduleContext";
import { isAbsoluteSlotInPast } from "../utils/editModeDrag";
import {
  isValidSyrianPhone,
  normalizeSyrianPhone,
  sanitizePhoneInput,
} from "@/lib/phone";

export interface TreatmentOption {
  id: string;
  name: string;
  baseDuration: number;
  basePrice: number;
}

export type ComplexityType = "standard" | "complex" | "elderly" | "urgent";

// Patient Profile Database Schema Interface
export interface PatientProfile {
  id: string;
  name: string;
  age: number;
  gender: "Male" | "Female";
  phone: string;
  address: string;
}

export interface WizardFormData {
  treatmentId: string;
  complexity: ComplexityType;
  date: Date | null;
  timeSlot: number | null;
  doctorId: string;
  isLockedToDoctor: boolean;
  notes: string;
  patientName: string;
  patientPhone: string;
  patientAge: string;
  patientGender: "Male" | "Female" | null;
  patientAddress: string;
  isExistingPatient: boolean;
  duration: number;
  fromGridSelection?: boolean;
}

const INITIAL_FORM_DATA: WizardFormData = {
  treatmentId: "",
  complexity: "standard",
  date: null,
  timeSlot: null,
  doctorId: "",
  isLockedToDoctor: false,
  notes: "",
  patientName: "",
  patientPhone: "",
  patientAge: "",
  patientGender: null,
  patientAddress: "",
  isExistingPatient: false,
  duration: 30,
  fromGridSelection: false,
};

export const TREATMENT_OPTIONS: TreatmentOption[] = [
  { id: "t1", name: "Follow-up Visit", baseDuration: 30, basePrice: 100000 },
  {
    id: "t2",
    name: "Initial Consultation",
    baseDuration: 45,
    basePrice: 150000,
  },
  { id: "t3", name: "Routine Check-up", baseDuration: 15, basePrice: 75000 },
];

export function useAppointmentWizard(
  doctors: DoctorType[],
  onSave: (data?: WizardFormData & { price: number }) => void,
  onClose: () => void,
) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<WizardFormData>(INITIAL_FORM_DATA);
  const [searchTreatment, setSearchTreatment] = useState("");
  const [searchDoctor, setSearchDoctor] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDuplicatePhone, setIsDuplicatePhone] = useState(false);
  const [lookupPatients, setLookupPatients] = useState<PatientProfile[]>([]);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { clinicId } = useScheduleContext();
  const [apiSlotMinutes, setApiSlotMinutes] = useState<number[]>([]);
  const isWizardOpen = useWizardDrawer((state) => state.isWizardOpen);
  const pendingRequestData = useWizardDrawer(
    (state) => state.pendingRequestData,
  );

  // بوابة المزامنة عند فتح الـ Wizard
  // ابحث عن الـ useEffect الخاص بالمزامنة واستبدله بهذا التعديل:
  const initialData = useWizardDrawer((state) => state.initialData);
  const editingAppointment = useWizardDrawer(
    (state) => state.editingAppointment,
  );
  const viewOnlyMode = useWizardDrawer((state) => state.viewOnlyMode);
  const originalDataRef = useRef<string>("");
  const prevIsWizardOpen = useRef(false);

  useEffect(() => {
    if (isWizardOpen && !prevIsWizardOpen.current) {
      if (editingAppointment) {
        const treatmentDuration =
          editingAppointment.end - editingAppointment.start;
        const formattedData: WizardFormData = {
          treatmentId: editingAppointment.treatmentId || "t1",
          complexity:
            (editingAppointment.complexity as ComplexityType) || "standard",
          date: editingAppointment.date
            ? new Date(editingAppointment.date)
            : new Date(),
          timeSlot: absoluteMinutesFromGridMinutes(editingAppointment.start),
          doctorId: editingAppointment.docId,
          isLockedToDoctor: editingAppointment.refuseTransfer || false,
          notes: editingAppointment.notes || "",
          patientName: editingAppointment.patient?.name || "",
          patientPhone: editingAppointment.patient?.phone || "",
          patientAge: String(editingAppointment.patient?.age || ""),
          patientGender:
            (editingAppointment.patient?.gender as "Male" | "Female") || null,
          patientAddress: editingAppointment.patient?.adddress || "",
          isExistingPatient: true,
          duration: treatmentDuration,
          fromGridSelection: false,
        };
        setFormData(formattedData);
        originalDataRef.current = JSON.stringify(formattedData);
      } else if (pendingRequestData && initialData) {
        const formattedData: WizardFormData = {
          ...INITIAL_FORM_DATA,
          doctorId: initialData.doctorId,
          date: new Date(initialData.date),
          treatmentId: pendingRequestData.treatmentId || "t1",
          timeSlot: absoluteMinutesFromGridMinutes(pendingRequestData.start),
          duration: Math.max(
            15,
            pendingRequestData.end - pendingRequestData.start ||
              initialData.duration,
          ),
          complexity:
            (pendingRequestData.complexity as ComplexityType) || "standard",
          isLockedToDoctor: pendingRequestData.refuseTransfer ?? false,
          patientName: pendingRequestData.patient?.name ?? "",
          patientPhone: pendingRequestData.patient?.phone ?? "",
          patientAge: pendingRequestData.patient?.age?.toString() ?? "",
          patientGender: pendingRequestData.patient?.gender ?? null,
          patientAddress: pendingRequestData.patient?.adddress ?? "",
          isExistingPatient: false,
          notes: "Assigned from pending request via schedule grid",
          fromGridSelection: true,
        };
        setFormData(formattedData);
        originalDataRef.current = JSON.stringify(formattedData);
      } else if (initialData) {
        const formattedData: WizardFormData = {
          ...INITIAL_FORM_DATA,
          treatmentId: "t1",
          complexity: "standard",
          date: new Date(initialData.date),
          timeSlot: initialData.timeSlot,
          duration: Math.max(15, initialData.duration),
          doctorId: initialData.doctorId,
          isLockedToDoctor: true,
          fromGridSelection: initialData.fromGridSelection ?? true,
        };
        setFormData(formattedData);
        originalDataRef.current = JSON.stringify(formattedData);
      } else if (pendingRequestData) {
        const matchedDoctor = doctors.find(
          (doc) => doc.id === pendingRequestData.docId,
        );

        const formattedData: WizardFormData = {
          ...INITIAL_FORM_DATA,
          doctorId: matchedDoctor ? matchedDoctor.id : pendingRequestData.docId,
          date: pendingRequestData.date ?? new Date(),
          treatmentId: pendingRequestData.treatmentId || "t1",
          timeSlot: absoluteMinutesFromGridMinutes(pendingRequestData.start),
          duration: pendingRequestData.duration || 30,
          complexity: pendingRequestData.complexity || "standard",
          isLockedToDoctor: pendingRequestData.refuseTransfer ?? false,
          patientName: pendingRequestData.patient?.name ?? "",
          patientPhone: pendingRequestData.patient?.phone ?? "",
          patientAge: pendingRequestData.patient?.age?.toString() ?? "",
          patientGender: pendingRequestData.patient?.gender ?? null,
          patientAddress: pendingRequestData.patient?.adddress ?? "",
          isExistingPatient: false,
          notes: `Created via Pending Request assigned on ${pendingRequestData.date} ${formatMinutesToAMPM(absoluteMinutesFromGridMinutes(pendingRequestData.start))}`,
        };
        setFormData(formattedData);
        originalDataRef.current = JSON.stringify(formattedData);
      } else {
        // Manual "New appointment": no default date — secretary picks it.
        const formattedData = { ...INITIAL_FORM_DATA, date: null as Date | null };
        setFormData(formattedData);
        originalDataRef.current = JSON.stringify(formattedData);
      }
      setCurrentStep(1);
    } else if (!isWizardOpen && prevIsWizardOpen.current) {
      setFormData(INITIAL_FORM_DATA);
      setCurrentStep(1);
      setSearchTreatment("");
      setSearchDoctor("");
      setSearchQuery("");
      originalDataRef.current = JSON.stringify(INITIAL_FORM_DATA);
    }
    prevIsWizardOpen.current = isWizardOpen;
  }, [
    isWizardOpen,
    pendingRequestData,
    initialData,
    doctors,
    editingAppointment,
  ]);

  const isDirty = useMemo(() => {
    // eslint-disable-next-line react-hooks/refs
    return JSON.stringify(formData) !== originalDataRef.current;
  }, [formData]);

  const selectedTreatment = useMemo(() => {
    return TREATMENT_OPTIONS.find((t) => t.id === formData.treatmentId) || null;
  }, [formData.treatmentId]);

  const computedDuration = useMemo(() => {
    return formData.duration;
  }, [formData.duration]);

  const computedPrice = useMemo(() => {
    if (!selectedTreatment) return 0;
    return selectedTreatment.basePrice;
  }, [selectedTreatment]);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return lookupPatients;
    const query = searchQuery.toLowerCase();
    return lookupPatients.filter((p) => p.name.toLowerCase().includes(query));
  }, [searchQuery, lookupPatients]);

  useEffect(() => {
    if (!accessToken || !isValidSyrianPhone(formData.patientPhone)) {
      setLookupPatients([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      let phone: string;
      try {
        phone = normalizeSyrianPhone(formData.patientPhone);
      } catch {
        return;
      }
      void lookupPatientByPhone(phone, accessToken)
        .then((result) => {
          if (cancelled) return;
          const name =
            result.fullName ||
            [result.firstName, result.lastName].filter(Boolean).join(" ").trim() ||
            "Patient";
          const profile: PatientProfile = {
            id: result.id,
            name,
            age: 0,
            gender: "Male",
            phone: result.phoneNumber,
            address: "",
          };
          setLookupPatients([profile]);
          setIsDuplicatePhone(
            !formData.isExistingPatient &&
              Boolean(formData.patientName) &&
              formData.patientName !== name,
          );
        })
        .catch(() => {
          if (!cancelled) {
            setLookupPatients([]);
            setIsDuplicatePhone(false);
          }
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    accessToken,
    formData.isExistingPatient,
    formData.patientName,
    formData.patientPhone,
  ]);

  const handleFieldChange = <K extends keyof WizardFormData>(
    field: K,
    value: WizardFormData[K],
  ) => {
    if (viewOnlyMode) return;
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      const locked = prev.isLockedToDoctor || prev.fromGridSelection;

      if (
        !locked &&
        (field === "treatmentId" || field === "complexity" || field === "date")
      ) {
        next.timeSlot = null;
        next.doctorId = "";
      }
      if (!locked && field === "timeSlot") {
        next.doctorId = "";
      }

      if (field === "patientPhone") {
        const cleanedPhone = sanitizePhoneInput(value as string);
        next.patientPhone = cleanedPhone;
        setIsDuplicatePhone(false);
        if (!cleanedPhone) {
          setLookupPatients([]);
        }
      }

      if (field === "patientAge") {
        next.patientAge = String(value).replace(/\D/g, "").slice(0, 3);
      }

      return next;
    });
  };

  const selectPatientFromSearch = (patient: PatientProfile) => {
    if (viewOnlyMode) return;
    setFormData((prev) => ({
      ...prev,
      patientName: patient.name,
      patientPhone: patient.phone,
      patientAge: patient.age.toString(),
      patientGender: patient.gender,
      patientAddress: patient.address,
      isExistingPatient: true,
    }));
    setSearchQuery("");
    setIsDuplicatePhone(false);
  };
  const availableDoctorsFiltered = useMemo(() => {
    const targetDateStr = formData.date
      ? new Date(formData.date).toDateString()
      : "";

    return doctors
      .map((doc) => {
        const appointmentsToday = (doc.appointments || []).filter((apt) => {
          if (!targetDateStr || !apt.date) return false;
          return new Date(apt.date).toDateString() === targetDateStr;
        });

        const dailyCount = appointmentsToday.length;
        let isAvailableAtSlot = true;

        if (formData.date && formData.timeSlot !== null) {
          const relativeStartTime = formData.timeSlot - START_TIME_MINUTES;
          const relativeEndTime = relativeStartTime + computedDuration;

          const hasConflict = appointmentsToday.some((apt) => {
            if (editingAppointment && apt.id === editingAppointment.id) {
              return false;
            }
            return (
              relativeStartTime < apt.end && relativeEndTime > apt.start
            );
          });
          isAvailableAtSlot = !hasConflict;
        }

        return {
          ...doc,
          specialty: doc.specialty || "General Dentist",
          appointmentsTodayCount: dailyCount,
          isAvailableAtSlot,
          isAvailable: true,
          appointments: appointmentsToday,
        };
      })
      .filter((doc) => {
        if (
          formData.isLockedToDoctor &&
          formData.doctorId &&
          doc.id === formData.doctorId
        ) {
          return doc.name.toLowerCase().includes(searchDoctor.toLowerCase());
        }
        if (formData.timeSlot !== null) {
          return (
            doc.isAvailableAtSlot &&
            doc.name.toLowerCase().includes(searchDoctor.toLowerCase())
          );
        }
        return doc.name.toLowerCase().includes(searchDoctor.toLowerCase());
      });
  }, [
    formData.date,
    formData.timeSlot,
    formData.doctorId,
    formData.isLockedToDoctor,
    doctors,
    computedDuration,
    editingAppointment,
    searchDoctor,
  ]);
  // فحص حارس الخطوة الأولى: نتحقق من أن الطبيب متاح وصالح لتفعيل زر الـ Next
  const isStep1Valid = useMemo(() => {
    if (
      !formData.treatmentId ||
      !formData.complexity ||
      !formData.date ||
      formData.timeSlot === null ||
      !formData.doctorId
    ) {
      return false;
    }
    if (formData.fromGridSelection || formData.isLockedToDoctor) {
      return true;
    }
    const chosenDoc = availableDoctorsFiltered.find(
      (d) => d.id === formData.doctorId,
    );
    return chosenDoc ? chosenDoc.isAvailableAtSlot : false;
  }, [formData, availableDoctorsFiltered]);

  const step2Errors = useMemo(() => {
    const ageValue = parseInt(formData.patientAge, 10);
    const phone = formData.patientPhone.trim();
    return {
      nameEmpty: formData.patientName.trim().length === 0,
      ageInvalid:
        formData.patientAge.trim().length === 0 ||
        isNaN(ageValue) ||
        ageValue < 0 ||
        ageValue > 120,
      genderEmpty: !formData.patientGender,
      phoneEmpty: phone.length === 0,
      phoneInvalid: phone.length > 0 && !isValidSyrianPhone(phone),
    };
  }, [formData, isDuplicatePhone]);

  const isStep2Valid = useMemo(() => {
    return !Object.values(step2Errors).some(Boolean);
  }, [step2Errors]);

  // Include the grid-selected time even when scheduling API returns a narrower list.
  // Never offer past times for today (or any past day).
  const availableTimeSlots = useMemo(() => {
    const merged = [...apiSlotMinutes];
    if (formData.timeSlot != null && !merged.includes(formData.timeSlot)) {
      merged.push(formData.timeSlot);
    }
    return merged
      .filter((mins) => !isAbsoluteSlotInPast(mins, formData.date))
      .sort((a, b) => a - b);
  }, [apiSlotMinutes, formData.timeSlot, formData.date]);

  // Clear a selected slot if it became past (e.g. clock crossed while wizard open).
  useEffect(() => {
    if (
      formData.timeSlot != null &&
      isAbsoluteSlotInPast(formData.timeSlot, formData.date)
    ) {
      setFormData((prev) => ({ ...prev, timeSlot: null }));
    }
  }, [formData.timeSlot, formData.date]);

  useEffect(() => {
    const selectedDay = formData.date;
    if (!isWizardOpen || !selectedDay || !clinicId || !accessToken) {
      setApiSlotMinutes([]);
      return;
    }

    const doctorIds = formData.doctorId
      ? [formData.doctorId]
      : doctors.map((doc) => doc.id).filter(Boolean);
    if (doctorIds.length === 0) {
      setApiSlotMinutes([]);
      return;
    }

    let cancelled = false;
    void Promise.all(
      doctorIds.map((doctorId) =>
        listAvailableSlots(
          {
            clinicId,
            doctorId,
            date: selectedDay,
            durationMinutes: computedDuration || 30,
          },
          accessToken,
        ).catch(() => ({ slots: [] as string[], closed: false })),
      ),
    ).then((results) => {
      if (cancelled) return;
      if (results.some((res) => res.closed)) {
        setApiSlotMinutes([]);
        return;
      }
      const minutes = [
        ...new Set(
          results.flatMap((res) =>
            (res.slots ?? []).map((iso) => absoluteMinutesFromIso(iso)),
          ),
        ),
      ].sort((a, b) => a - b);
      setApiSlotMinutes(minutes);
    });

    return () => {
      cancelled = true;
    };
  }, [
    isWizardOpen,
    formData.date,
    formData.doctorId,
    computedDuration,
    clinicId,
    accessToken,
    doctors,
  ]);

  // 🔥 تعديل جوهري: تصفية وحذف الطبيب المتعارض فوراً، وعرض الطبيب المتاح فقط!

  const handleNext = () => {
    if (currentStep === 1 && (isStep1Valid || viewOnlyMode)) setCurrentStep(2);
    else if (currentStep === 2 && (isStep2Valid || viewOnlyMode)) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) setCurrentStep(1);
    else if (currentStep === 3) setCurrentStep(2);
  };

  const handleFinalSubmit = () => {
    if (viewOnlyMode) return;
    if (isStep1Valid && isStep2Valid) {
      const relativeTimeSlot =
        formData.timeSlot !== null ? formData.timeSlot : 0;

      onSave({
        ...formData,
        timeSlot: relativeTimeSlot,
        duration: computedDuration,
        price: computedPrice,
      });

      setFormData(INITIAL_FORM_DATA);
      setCurrentStep(1);
      onClose();
    }
  };

  const handleDurationChange = (newDuration: number) => {
    if (viewOnlyMode || formData.fromGridSelection) return;
    setFormData((prev) => ({ ...prev, duration: Math.max(15, newDuration) }));
  };

  return {
    currentStep,
    setCurrentStep,
    formData,
    computedDuration,
    computedPrice,
    selectedTreatment,
    availableTimeSlots,
    availableDoctorsFiltered,
    doctors,
    isStep1Valid,
    isStep2Valid,
    step2Errors,
    isDuplicatePhone,
    searchTreatment,
    setSearchTreatment,
    searchDoctor,
    setSearchDoctor,
    searchQuery,
    setSearchQuery,
    filteredPatients,
    selectPatientFromSearch,
    handleFieldChange,
    handleNext,
    handleBack,
    handleFinalSubmit,
    handleDurationChange,
    isDirty,
    viewOnlyMode,
  };
}
