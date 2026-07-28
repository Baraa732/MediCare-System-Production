import { useState, useMemo, useEffect, useRef } from "react";
import type { DoctorType } from "@/features/dashboardAssitant/types";
import { useWizardDrawer } from "../hooks/useWizardDrawer";
import { START_TIME_MINUTES } from "../data/scheduleGrid";
import { formatMinutesToAMPM } from "../components/SchedualeGrid/DNDGrid/utils/timeFormatters";

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
  date: Date;
  timeSlot: number | null;
  doctorId: string;
  isLockedToDoctor: boolean;
  notes: string;
  // Step 2 Form Attributes upgraded from image_312683.png
  patientName: string;
  patientPhone: string;
  patientAge: string;
  patientGender: "Male" | "Female" | null;
  patientAddress: string;
  isExistingPatient: boolean; // Tracks if profile was linked from DB
  duration: number; // حقل جديد للمدة
}

const INITIAL_FORM_DATA: WizardFormData = {
  treatmentId: "",
  complexity: "standard",
  date: new Date(),
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
  duration: 15,
};

// Sample Database for Autocomplete Queries
const MOCK_PATIENT_DATABASE: PatientProfile[] = [
  {
    id: "p1",
    name: "Mohammad Ahmad",
    age: 28,
    gender: "Male",
    phone: "+963 99 123 4567",
    address: "Damascus, Sahnaya",
  },
  {
    id: "p2",
    name: "Mohammad Ali",
    age: 34,
    gender: "Female",
    phone: "+963 93 444 5555",
    address: "Damascus, Malki",
  },
  {
    id: "p3",
    name: "Mohammad Hassan",
    age: 52,
    gender: "Male",
    phone: "+963 95 777 8888",
    address: "Rif Dimashq",
  },
  {
    id: "p4",
    name: "Ali Ahmad",
    age: 22,
    gender: "Male",
    phone: "+963 99 111 2222",
    address: "Damascus",
  },
];

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
if (isWizardOpen && !prevIsWizardOpen.current) {      if (editingAppointment) {
        const treatmentDuration =
          editingAppointment.end - editingAppointment.start;
        const formattedData: WizardFormData = {
          treatmentId: editingAppointment.treatmentId,
          complexity:
            (editingAppointment.complexity as ComplexityType) || "standard",
          date: editingAppointment.date
            ? new Date(editingAppointment.date)
            : new Date(),
          timeSlot: editingAppointment.start + START_TIME_MINUTES,
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
        };
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData(formattedData);
        originalDataRef.current = JSON.stringify(formattedData);
      } else if (initialData) {
        console.log(
          `new Date(initialData.date).toDateString():${new Date(initialData.date).toDateString()}`,
        );
        // 🟢 التعبئة التلقائية الفورية وحل مشكلة عدم تحديد الطبيب والوقت
        setFormData((prev) => ({
          ...prev,
          treatmentId: "t1", // علاج افتراضي أولي لتجنب الفراغ
          complexity: "standard",
          date: initialData.date,
          timeSlot: initialData.timeSlot, // تعيين وقت البداية الحقيقي المحسوب بدقة
          duration: initialData.duration, // تعيين المدة الإجمالية من طول السحب
          doctorId: initialData.doctorId, // تثبيت معرّف الطبيب الصحيح للعمود
          isLockedToDoctor: true,
          patientName: "",
          patientPhone: "",
          patientAge: "",
          patientGender: null,
          patientAddress: "",
          isExistingPatient: false,
          notes: "",
        }));
      } else if (pendingRequestData) {
        // 🔵 الحالة الخاصة بـ Pending Request الإضافية
        const matchedDoctor = doctors.find(
          (doc) => doc.id === pendingRequestData.docId,
        );

        setFormData((prev) => ({
          ...prev,
          doctorId: matchedDoctor ? matchedDoctor.id : "",
          date: pendingRequestData.date,
          treatmentId: pendingRequestData.treatmentId,
          timeSlot: pendingRequestData.start,
          duration: pendingRequestData.duration,
          complexity: pendingRequestData.complexity,
          isLockedToDoctor: pendingRequestData.refuseTransfer,
          patientName: pendingRequestData.patient.name,
          patientPhone: pendingRequestData.patient.phone,
          patientAge: pendingRequestData.patient.age.toString(),
          patientGender: pendingRequestData.patient.gender,
          patientAddress: pendingRequestData.patient.adddress,
          isExistingPatient: false,
          notes: `Created via Pending Request assigned on ${pendingRequestData.date} ${formatMinutesToAMPM(pendingRequestData.start)}`,
        }));
      }
      setCurrentStep(1);
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
    if (!searchQuery.trim()) return [];
    return MOCK_PATIENT_DATABASE.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery]);

  const handleFieldChange = <K extends keyof WizardFormData>(
    field: K,
    value: WizardFormData[K],
  ) => {
    if (viewOnlyMode) return;
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      if (
        field === "treatmentId" ||
        field === "complexity" ||
        field === "date"
      ) {
        next.timeSlot = null;
        next.doctorId = "";
      }
      if (field === "timeSlot") {
        next.doctorId = "";
      }

      if (field === "patientPhone") {
        const cleanedPhone = (value as string).replace(/\s+/g, "");
        const holdsDuplicate = MOCK_PATIENT_DATABASE.some(
          (p) =>
            p.phone.replace(/\s+/g, "") === cleanedPhone &&
            p.name !== prev.patientName,
        );
        setIsDuplicatePhone(next.isExistingPatient ? false : holdsDuplicate);
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

    return (
      doctors
        .map((doc) => {
          // 1. استخراج مواعيد الطبيب الخاصة باليوم المختار فقط
          const appointmentsToday = (doc.appointments || []).filter(
            (apt) =>
              apt.date && new Date(apt.date).toDateString() === targetDateStr,
          );

          const dailyCount = appointmentsToday.length;
          let isAvailableAtSlot = true;

          // 2. إذا حدد المستخدم تاريخ ووقت، نقوم بفحص التضارب لليوم والوقت والمدة بدقة
          if (formData.date && formData.timeSlot !== null) {
            const relativeStartTime = formData.timeSlot - START_TIME_MINUTES;
            const relativeEndTime = relativeStartTime + computedDuration;

            const hasConflict = appointmentsToday.some((apt) => {
              // 🔥 CRITICAL FIX: Ignore the appointment currently being updated to prevent self-validation conflict.
              if (editingAppointment && apt.id === editingAppointment.id)
                return false;
              if (formData.timeSlot === null) return false;
              return relativeStartTime < apt.end && relativeEndTime > apt.start;
            });
            isAvailableAtSlot = !hasConflict;
          }

          return {
            ...doc,
            specialty: doc.specialty || "General Dentist",
            appointmentsTodayCount: dailyCount,
            isAvailableAtSlot: isAvailableAtSlot,
            isAvailable: true, // محاذاة الحالة لضمان التوافق البصري
            appointments: appointmentsToday,
          };
        })
        // 🔥 الفلترة الحقيقية: إذا تم اختيار وقت، لا تعرض إلا الطبيب المتاح فقط (تخفي أي طبيب غير متاح)
        .filter((doc) => {
          if (formData.timeSlot !== null) {
            return (
              doc.isAvailableAtSlot &&
              doc.name.toLowerCase().includes(searchDoctor.toLowerCase())
            );
          }
          return doc.name.toLowerCase().includes(searchDoctor.toLowerCase());
        })
    );
  }, [formData.date, formData.timeSlot, doctors, computedDuration, editingAppointment, searchDoctor]);
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
    const chosenDoc = availableDoctorsFiltered.find(
      (d) => d.id === formData.doctorId,
    );
    return chosenDoc ? chosenDoc.isAvailableAtSlot : false;
  }, [formData, availableDoctorsFiltered]);

  const step2Errors = useMemo(() => {
    const ageValue = parseInt(formData.patientAge, 10);
    return {
      nameEmpty: formData.patientName.trim().length === 0,
      ageInvalid: isNaN(ageValue) || ageValue < 0 || ageValue > 120,
      genderEmpty: !formData.patientGender,
      phoneEmpty: formData.patientPhone.trim().length < 7 || isDuplicatePhone,
    };
  }, [formData, isDuplicatePhone]);

  const isStep2Valid = useMemo(() => {
    return !Object.values(step2Errors).some(Boolean);
  }, [step2Errors]);

  // حساب أوقات المواعيد المتاحة للعيادة
  const availableTimeSlots = useMemo(() => {
    if (!formData.date || computedDuration === 0) return [];

    const slots: number[] = [];
    const DAY_START_OFFICIAL = START_TIME_MINUTES; // بداية الدوام الرسمي للعيادة (مثلاً 480 دقيقة = 8:00 AM)
    const DAY_END = START_TIME_MINUTES * 4; // نهاية الدوام الرسمي للعيادة (6:00 PM تعادل 1080 دقيقة من منتصف الليل)

    // 1. حساب التاريخ المختار واليوم الحالي لمقارنتهما
    const selectedDate = new Date(formData.date);
    // console.log(selectedDate.toDateString())
    const now = new Date();

    const isToday = selectedDate.toDateString() === now.toDateString();
    const targetDateStr = selectedDate.toDateString();

    // 2. تحديد نقطة البداية للفحص:
    let searchStartMinutes = DAY_START_OFFICIAL;

    if (isToday) {
      // 1. حساب الدقائق الحالية من منتصف الليل بشكل دقيق
      const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();

      // 2. تقريب الوقت الحالي لأقرب 15 دقيقة دائماً إلى الأعلى (مثال: 16 تصبح 30)
      const roundedCurrentMinutes =
        Math.ceil(currentMinutesFromMidnight / 15) * 15;

      // 3. مقارنتها مع بداية الدوام الرسمي للعيادة
      searchStartMinutes = Math.max(DAY_START_OFFICIAL, roundedCurrentMinutes);
    }

    // 3. حلقة توليد الفترات الزمنية المتاحة (Slots) بناءً على الـ Step (كل 15 دقيقة)
    for (
      let time = searchStartMinutes;
      time + computedDuration <= DAY_END;
      time += 15
    ) {
      const isAnyDoctorFree = doctors.some((doc) => {
        // جلب مواعيد الطبيب الخاصة باليوم المحدد فقط
        const appointmentsToday = (doc.appointments || []).filter(
          (apt) =>
            apt.date && new Date(apt.date).toDateString() === targetDateStr,
        );

        // تحويل الوقت المطلق الحالي في الحلقة إلى وقت نسبي (Grid Relative) لمقارنته بأبعاد مواعيد الجدول الملتصقة بـ START_TIME_MINUTES
        const relativeStart = time - START_TIME_MINUTES;
        const relativeEnd = relativeStart + computedDuration;

        // فحص التداخل الدقيق: Max(Start1, Start2) < Min(End1, End2)
        return !appointmentsToday.some(
          (apt) =>
            Math.max(relativeStart, apt.start) < Math.min(relativeEnd, apt.end),
        );
      });

      if (isAnyDoctorFree) {
        slots.push(time);
      }
    }

    return slots;
  }, [formData.date, computedDuration, doctors]);

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
    if (viewOnlyMode) return;
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
