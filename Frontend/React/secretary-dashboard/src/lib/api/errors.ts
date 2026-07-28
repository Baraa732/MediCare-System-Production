import { ApiError, type ApiErrorBody } from "./types";

interface ParsedApiError {
  message: string;
  code?: string;
  suggestion?: string;
}

export function parseApiErrorPayload(data: unknown): ParsedApiError | null {
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;

  if (record.error && typeof record.error === "object") {
    const nested = record.error as ApiErrorBody;
    if (typeof nested.message === "string") {
      return {
        message: nested.message,
        code: nested.code,
        suggestion: nested.suggestion,
      };
    }
  }

  if (typeof record.message === "string") {
    return { message: record.message };
  }

  if (typeof record.message === "object" && record.message !== null) {
    const nested = record.message as ApiErrorBody;
    if (typeof nested.message === "string") {
      return {
        message: nested.message,
        code: nested.code,
        suggestion: nested.suggestion,
      };
    }
  }

  return null;
}

const MESSAGE_MAP: Record<string, string> = {
  "Invalid or expired OTP":
    "The verification code is incorrect or has expired. Check WhatsApp and try again, or resend a new code.",
  "Invalid or expired MFA token":
    "Your verification session has expired. Please sign in again.",
  "Invalid MFA token type":
    "Your verification session is invalid. Please sign in again.",
  "Invalid MFA token":
    "Your verification session is invalid. Please sign in again.",
  "Too many login attempts. Please complete the CAPTCHA challenge.":
    "Too many sign-in attempts. Please wait about 15 minutes, then try again.",
  "Invalid credentials":
    "The phone number or password doesn't look right. Please check both and try again.",
  "Authentication failed":
    "Your session has expired. Please sign in again.",
  "Account locked. Please contact support.":
    "Your account is locked for security. Please contact your clinic administrator or support.",
  "Please activate your dashboard before logging in":
    "Your account isn't activated yet. Use the activation link from your clinic administrator.",
  "One or more fields are invalid.":
    "Please check your phone number format (e.g. +963912345680) and try again.",
  "Bad gateway — upstream service unreachable":
    "We're having trouble connecting to the server. Please try again in a moment.",
  "Service temporarily unavailable. Please retry in a moment.":
    "The service is temporarily unavailable. Please wait a moment and try again.",
  "Failed to fetch":
    "We couldn't reach the server. Make sure you're online and the clinic system is running.",
  "Invalid or expired activation token":
    "Your activation session has expired. Please sign in and verify your code again.",
  "Phone number not registered":
    "This phone number is not registered. Contact your clinic administrator.",
  "Session has been revoked or expired":
    "Your session has expired. Please sign in again.",
  "Invalid or expired token":
    "Your session has expired. Please sign in again.",
  "Token has been revoked":
    "Your session has expired. Please sign in again.",
  "You do not have access to this clinic":
    "You are not assigned to this clinic. Contact your clinic administrator.",
  "Missing tenant context":
    "Your clinic session is not ready yet. Please sign out, sign in again, or refresh the page.",
  "Not authorized":
    "You are not allowed to perform this action.",
  "No clinic assigned to this secretary account.":
    "Your account has no clinic assigned. Contact your clinic administrator.",
  "No patient account found for this phone number":
    "No patient was found with this phone number. Ask the patient to register first.",
  "Account is not pending activation":
    "Your account is already active. Please sign in with your password.",
  "Activation period has expired. Contact your clinic administrator.":
    "Your activation window has expired. Contact your clinic administrator for a new invite.",
  "Authorization header is required":
    "The server blocked this request before sign-in. If you were resetting your password, restart the API gateway and try again.",
};

function mapByCode(code: string | undefined, message: string): string | null {
  switch (code) {
    case "UNAUTHORIZED":
      if (message.toLowerCase().includes("credential")) {
        return MESSAGE_MAP["Invalid credentials"] ?? null;
      }
      if (message.toLowerCase().includes("locked")) {
        return (
          MESSAGE_MAP[message] ??
          "Your account is temporarily locked. Wait a few minutes or contact support."
        );
      }
      return MESSAGE_MAP[message] ?? null;
    case "VALIDATION_ERROR":
      if (message.toLowerCase().includes("uuid")) {
        return "Your clinic information is missing or invalid. Please sign out and sign in again, or contact your administrator.";
      }
      return "Some fields are invalid. Please check your input and try again.";
    case "FORBIDDEN":
      return (
        MESSAGE_MAP[message] ??
        (message.toLowerCase().includes("clinic")
          ? MESSAGE_MAP["You do not have access to this clinic"]
          : message)
      );
    case "RATE_LIMITED":
      return message;
    case "INTERNAL_ERROR":
      return "Something went wrong on our side. Please try again in a moment.";
    default:
      return null;
  }
}

export function toUserFriendlyMessage(
  err: ApiError | string,
  fallback = "Something went wrong. Please try again.",
): string {
  if (typeof err === "string") {
    return MESSAGE_MAP[err] ?? err;
  }

  const waitMatch = err.message.match(
    /^Please wait (\d+) minutes before requesting a new OTP$/,
  );
  if (waitMatch) {
    return `A verification code was already sent. You can request a new one in ${waitMatch[1]} minute(s).`;
  }

  const retryMatch = err.message.match(
    /^Too many .+ Please try again in (\d+) seconds\.$/,
  );
  if (retryMatch) {
    return `Too many sign-in attempts. Please wait ${retryMatch[1]} seconds and try again.`;
  }

  const lockMatch = err.message.match(
    /^Account temporarily locked\. Retry in (\d+)s\.$/,
  );
  if (lockMatch) {
    return `Your account is temporarily locked after several failed attempts. Try again in ${lockMatch[1]} seconds.`;
  }

  const phoneLimitMatch = err.message.match(
    /^Too many login attempts\. Please try again in (\d+) seconds\.$/,
  );
  if (phoneLimitMatch) {
    const minutes = Math.ceil(Number(phoneLimitMatch[1]) / 60);
    return `Too many sign-in attempts. Please wait about ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`;
  }

  const failedLoginMatch = err.message.match(
    /^Too many failed login attempts\. Please try again in (\d+) seconds\.$/,
  );
  if (failedLoginMatch) {
    return `Too many sign-in attempts. Please wait ${failedLoginMatch[1]} seconds and try again.`;
  }

  const ipLockMatch = err.message.match(
    /^Too many login attempts from this IP\. Retry in (\d+)s\.$/,
  );
  if (ipLockMatch) {
    return `Too many sign-in attempts from this device. Please wait ${ipLockMatch[1]} seconds.`;
  }

  const mapped = MESSAGE_MAP[err.message];
  if (mapped) return mapped;

  const byCode = mapByCode(err.code, err.message);
  if (byCode) return byCode;

  if (err.status === 401) {
    return MESSAGE_MAP["Invalid credentials"] ?? fallback;
  }

  if (err.message?.startsWith("Request failed (")) {
    if (err.status === 502 || err.status === 503) {
      return MESSAGE_MAP["Service temporarily unavailable. Please retry in a moment."] ?? fallback;
    }
    if (err.status === 401) {
      return MESSAGE_MAP["Invalid credentials"] ?? fallback;
    }
  }

  if (err.suggestion && !err.suggestion.includes("POST /api/")) {
    return `${MESSAGE_MAP[err.message] ?? err.message} ${err.suggestion}`;
  }

  if (err.message && !err.message.startsWith("Request failed")) {
    return err.message;
  }

  return fallback;
}

export const LOGIN_ERROR_FALLBACK =
  "We couldn't sign you in. Check your phone number and password, or tap Forgot password below.";

export function toLoginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return toUserFriendlyMessage(err, LOGIN_ERROR_FALLBACK);
  }

  if (err instanceof Error) {
    const mapped = MESSAGE_MAP[err.message];
    if (mapped) return mapped;
    if (err.message === "Failed to fetch") {
      return MESSAGE_MAP["Failed to fetch"] ?? LOGIN_ERROR_FALLBACK;
    }
  }

  return LOGIN_ERROR_FALLBACK;
}

export function normalizeCaughtError(
  err: unknown,
  fallback: string,
): string {
  if (err instanceof ApiError) {
    return toPasswordResetErrorMessage(err, fallback);
  }

  if (err instanceof Error && err.message) {
    return MESSAGE_MAP[err.message] ?? err.message;
  }

  return fallback;
}

export function toPasswordResetErrorMessage(
  err: ApiError,
  fallback: string,
): string {
  if (
    err.status === 401 &&
    (err.message === "Authorization header is required" ||
      err.message === "Authentication failed")
  ) {
    return "Password reset is temporarily unavailable. Restart the API gateway (or Docker stack) and try again.";
  }

  return toUserFriendlyMessage(err, fallback);
}
