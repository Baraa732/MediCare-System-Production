/** Normalize Syrian phone numbers to +963XXXXXXXXX (matches backend PhoneUtils). */

const PHONE_HINT =
  "Use +963XXXXXXXXX, 09XXXXXXXX, or 9XXXXXXXX";

export function sanitizePhoneInput(raw: string): string {
  // Keep leading +, digits only otherwise (blocks letters / symbols).
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  const hasPlus = cleaned.startsWith("+");
  const digits = cleaned.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export function normalizeSyrianPhone(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.startsWith("963") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `+963${digits.slice(1)}`;
  }
  if (digits.length === 9 && digits.startsWith("9")) {
    return `+963${digits}`;
  }

  throw new Error(`Invalid phone number. ${PHONE_HINT}.`);
}

export function isValidSyrianPhone(phoneNumber: string): boolean {
  try {
    normalizeSyrianPhone(phoneNumber);
    return true;
  } catch {
    return false;
  }
}

export function formatPhoneDisplay(phone: string): string {
  try {
    return normalizeSyrianPhone(phone);
  } catch {
    return phone;
  }
}

export const SYRIAN_PHONE_HINT = PHONE_HINT;
