/** Normalize Syrian phone numbers to +963XXXXXXXXX (matches backend PhoneUtils). */
export function normalizeSyrianPhone(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.startsWith("963") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `+963${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `+963${digits}`;
  }

  throw new Error(
    "Invalid phone number. Use +963XXXXXXXXX, 0XXXXXXXXX, or 9 digits.",
  );
}

export function formatPhoneDisplay(phone: string): string {
  try {
    return normalizeSyrianPhone(phone);
  } catch {
    return phone;
  }
}
