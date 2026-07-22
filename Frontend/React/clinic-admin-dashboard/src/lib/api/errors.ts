import { ApiError } from "./types";

const MESSAGE_MAP: Record<string, string> = {
  "Invalid credentials":
    "The phone number or password doesn't look right. If you haven't registered yet, complete your admin account first.",
  "Please activate your dashboard before logging in":
    "Your account isn't activated yet. Use your 6-digit activation code first.",
  "You must activate your dashboard code before registering.":
    "Activate your 6-digit clinic code before creating an account.",
  "Invalid activation code":
    "That activation code isn't valid. Check the 6 digits and try again.",
  "This activation code is for a different phone number":
    "This code belongs to a different phone number. Use the number on your welcome message.",
  "Activation code has expired":
    "This activation code has expired. Ask MediCare for a new one.",
  "Activation code has already been used":
    "This code was already used. Continue to registration or sign in if you already have an account.",
  "This phone number is already registered.":
    "This phone number already has an account. Sign in instead.",
  "This phone number already has a pending staff invite.":
    "This phone number already has a pending staff invite. Ask them to sign in with their temporary password, or try again to resend credentials.",
  "One or more fields are invalid.":
    "Please check the form — some fields are missing or invalid.",
  "Failed to fetch":
    "We couldn't reach the server. Make sure you're online and the clinic system is running.",
};

export function toLoginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return MESSAGE_MAP[err.message] ?? err.message;
  }
  if (err instanceof Error && MESSAGE_MAP[err.message]) {
    return MESSAGE_MAP[err.message];
  }
  return "We couldn't sign you in. Check your phone number and password.";
}

export function normalizeCaughtError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const mapped = MESSAGE_MAP[err.message];
    if (mapped) return mapped;
    if (err.suggestion) return `${err.message} ${err.suggestion}`;
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) {
    return MESSAGE_MAP[err.message] ?? err.message;
  }
  return fallback;
}
