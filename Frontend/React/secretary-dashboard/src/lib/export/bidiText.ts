const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function containsArabic(value?: string | null): boolean {
  return ARABIC_RE.test(value ?? "");
}

export function excelReadingOrder(value?: string | null): "rtl" | "ltr" {
  return containsArabic(value) ? "rtl" : "ltr";
}
