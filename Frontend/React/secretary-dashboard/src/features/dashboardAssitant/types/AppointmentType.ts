import type { ComplexityType } from "../CreateAppointmentWizard/useAppointmentWizard";

export interface AppointmentType {
  // 🆔 الحقول الأساسية لمحرك الجدولة والـ Drag and Drop
  id: string;
  start: number; // وقت البداية بالدقائق النسبية للجدول
  end: number; // وقت النهاية بالدقائق النسبية للجدول
  docId: string; // معرّف الطبيب المسؤول
  status: string; // حالة الموعد (confirmed, urgent, in_progress, unavailable)
  title?: string; // عنوان أو اسم الإجراء الطبي
date:Date;
  // 🦷 تفاصيل العلاج والزيارة الطبية (Extracted from summaryRows)
  treatmentId: string; // معرّف العلاج المختار
  complexity: ComplexityType; // درجة التعقيد
  duration: number; // مدة الموعد بالدقائق الفردية
  price: number; // السعر محسوباً بالعملة المحلية SYP
  notes?: string; // ملاحظات إضافية تم تدوينها

  // 👤 الملف الشخصي وبيانات المريض (Extracted from summaryRows)
  patient?: {
    name: string;
    age: number;
    phone: string;
    gender: "Male" | "Female" | null;
    adddress: string;
  };
  // 🛡️ قيود استراتيجية حل النزاعات والـ Auto-Mitigation
  refuseTransfer: boolean; // رفض أو قبول النقل التلقائي لطبيب آخر عند حدوث تعارض زمني
}
