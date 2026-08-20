import { Calendar, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { PendingRequest, QuickStateType } from "../types";
import { usePendingRequest } from "../hooks/usePendingRequest";
import { useDragHandlers } from "../components/SchedualeGrid/DNDGrid/hooks/useDragHandlers";

export const QuickState: () => QuickStateType[] = () => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const requests = usePendingRequest((state) => state.requests);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { doctors } = useDragHandlers();
  const countAppointments = doctors.reduce<number>((acc, doc) => {
    return acc + doc.appointments.length;
  }, 0);
  return [
    {
      label: "Total appointments",
      count: countAppointments,
      icon: Calendar,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Checked In",
      count: 12,
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-50",
    },
    {
      label: "No-shows",
      count: 2,
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-50",
    },
    {
      label: "Pending",
      count: requests.length,
      icon: Clock,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];
};


export const INITIAL_REQUESTS: PendingRequest[] = [
  {
    // 1. طلب اعتيادي - مريض شاب لفحص دوري
    id: "req-1",
    start: 1305, // 9:00 AM (نسبةً لبداية اليوم المطلقة أو النسبية للجدول)
    end: 1330,   // 9:30 AM (المدة 30 دقيقة)
    docId: "doc-1",
    status: "confirmed",
    title: "Routine Checkup",
    date: new Date("2026-07-013"),
    treatmentId: "t1",
    complexity: "standard",
    duration: 30,
    price: 50000,
    notes: "Patient requests a routine scaling and polished cleaning if time permits.",
    patient: {
      name: "Folan Alfolani 1",
      age: 28,
      phone: "0933111222",
      gender: "Male",
      adddress: "Sahnaya, Damascus",
    },
    refuseTransfer: true,
    timeRequistAgo: 1440, // يعادل يوم واحد مضى بالدقائق (1 d ago)
  },
  {
    // 2. حالة طارئة ومعقدة لخلع جراحي لمريض مسن
    id: "req-2",
    start: 600, // 10:00 AM
    end: 660,   // 11:00 AM (المدة 60 دقيقة)
    docId: "doc-2",
    status: "urgent",
    title: "Surgical Extraction",
    date: new Date("2026-05-05"),
    treatmentId: "t2",
    complexity: "elderly",
    duration: 60,
    price: 150000,
    notes: "Patient is hypertensive. Needs careful local anesthesia monitoring.",
    patient: {
      name: "Ahmad Mansour",
      age: 67,
      phone: "0944333222",
      gender: "Male",
      adddress: "Ashrafiyat Sahnaya, Rif Dimashq",
    },
    refuseTransfer: true, // يرفض النقل لطبيب آخر بسبب حساسية الحالة
    timeRequistAgo: 120, // ساعتان مضت (2 h ago)
  },
  {
    // 3. معالجة لبية معقدة (Root Canal) - مريضة ترفض التبديل
    id: "req-3",
    start: 720, // 12:00 PM
    end: 780,   // 1:00 PM (المدة 60 دقيقة)
    docId: "doc-1",
    status: "confirmed",
    title: "Root Canal Therapy",
    date: new Date("2026-05-05"),
    treatmentId: "t3",
    complexity: "complex",
    duration: 60,
    price: 200000,
    notes: "Second session for molar nerve treatment. Prefers Dr. Folan explicitly.",
    patient: {
      name: "Laila Al-Homsi",
      age: 34,
      phone: "0955666777",
      gender: "Female",
      adddress: "Jaramana, Damascus",
    },
    refuseTransfer: true,
    timeRequistAgo: 30, // 30 دقيقة مضت (30 m ago)
  },
  {
    // 4. حالة مستعجلة لطفل يعاني من ألم حاد
    id: "req-4",
    start: 840, // 2:00 PM
    end: 875,   // 2:35 PM (المدة 35 دقيقة)
    docId: "doc-3",
    status: "urgent",
    title: "Acute Toothache Relief",
    date: new Date("2026-05-05"),
    treatmentId: "t1",
    complexity: "urgent",
    duration: 35,
    price: 75000,
    notes: "Pediatric management. Requires calm handling. High priority score.",
    patient: {
      name: "Sami Al-Khatib",
      age: 9,
      phone: "0988777666",
      gender: "Male",
      adddress: "Sahnaya, Main Street",
    },
    refuseTransfer: false, // يمكن نقله لطبيب أطفال آخر إذا كان متفرغاً
    timeRequistAgo: 15, // 15 دقيقة مضت (15 m ago)
  },
  {
    // 5. موعد تجميلي (Cosmetic composite fillings)
    id: "req-5",
    start: 900, // 3:00 PM
    end: 945,   // 3:45 PM (المدة 45 دقيقة)
    docId: "doc-2",
    status: "confirmed",
    title: "Composite Veneers",
    date: new Date("2026-05-06"), // موعد لليوم التالي
    treatmentId: "t4",
    complexity: "standard",
    duration: 45,
    price: 350000,
    notes: "Esthetic zone front teeth fillings. Wants shade BL2.",
    patient: {
      name: "Rania Ward",
      age: 23,
      phone: "0999222333",
      gender: "Female",
      adddress: "Midan, Damascus",
    },
    refuseTransfer: false,
    timeRequistAgo: 2880, // يومان مضت (2 d ago)
  },
  {
    // 6. استشارة تقويمية أولية ليافع
    id: "req-6",
    start: 960, // 4:00 PM
    end: 980,   // 4:20 PM (المدة 20 دقيقة)
    docId: "doc-4",
    status: "confirmed",
    title: "Orthodontic Consultation",
    date: new Date("2026-05-05"),
    treatmentId: "t5",
    complexity: "standard",
    duration: 20,
    price: 40000,
    notes: "Initial mapping and taking impressions for orthodontic study model.",
    patient: {
      name: "Youssef Darwish",
      age: 16,
      phone: "0911555444",
      gender: "Male",
      adddress: "Sahnaya, Rif Dimashq",
    },
    refuseTransfer: false,
    timeRequistAgo: 480, // 8 ساعات مضت (8 h ago)
  },
  {
    // 7. صيانة دورية لجهاز تقويم متحرك لمريض مسن
    id: "req-7",
    start: 1020, // 5:00 PM
    end: 1050,  // 5:30 PM (المدة 30 دقيقة)
    docId: "doc-3",
    status: "confirmed",
    title: "Denture Adjustment",
    date: new Date("2026-05-05"),
    treatmentId: "t6",
    complexity: "elderly",
    duration: 30,
    price: 60000,
    notes: "Lower complete denture has a sore spot on the lingual ridge. Needs grinding.",
    patient: {
      name: "Mariam Al-Ali",
      age: 72,
      phone: "0966444888",
      gender: "Female",
      adddress: "Sahnaya, Syria",
    },
    refuseTransfer: true,
    timeRequistAgo: 60, // ساعة واحدة مضت (1 h ago)
  },
  {
    // 8. جراحة لثة بسيطة (Gingivectomy)
    id: "req-8",
    start: 1080, // 6:00 PM
    end: 1125,  // 6:45 PM (المدة 45 دقيقة)
    docId: "doc-1",
    status: "confirmed",
    title: "Laser Gingivectomy",
    date: new Date("2026-05-05"),
    treatmentId: "t7",
    complexity: "complex",
    duration: 45,
    price: 180000,
    notes: "Laser cosmetic contouring for gummy smile, upper anterior block.",
    patient: {
      name: "Karam Al-Shaar",
      age: 29,
      phone: "0922888999",
      gender: "Male",
      adddress: "Shaalan, Damascus",
    },
    refuseTransfer: false,
    timeRequistAgo: 5, // قبل 5 دقائق فقط (5 m ago)
  },
];
