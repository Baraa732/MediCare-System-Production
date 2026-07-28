import { ApiError, type ApiErrorBody } from "./types";
import { useAuthStore } from "@/stores/authStore";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

const NO_REFRESH_PATHS = [
  "/auth/login",
  "/auth/refresh-token",
  "/auth/register",
  "/auth/verify-otp",
  "/auth/resend-otp",
  "/auth/resend-mfa-otp",
  "/auth/staff/complete-activation",
  "/auth/forgot-password/send-otp",
  "/auth/forgot-password/verify-otp",
  "/auth/reset-password",
];

const IDEMPOTENT_POST_PATHS = ["/auth/register"];

function buildRequestHeaders(
  path: string,
  method: string | undefined,
  token: string | null | undefined,
  tenantId: string | undefined,
  extra?: HeadersInit,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
  };

  if (
    method?.toUpperCase() === "POST" &&
    IDEMPOTENT_POST_PATHS.some((p) => path.startsWith(p))
  ) {
    headers["Idempotency-Key"] = crypto.randomUUID();
  }

  if (extra) {
    if (extra instanceof Headers) {
      extra.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(extra)) {
      for (const [key, value] of extra) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, extra);
    }
  }

  return headers;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
  _retried?: boolean;
};

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, updateTokens, logout } = useAuthStore.getState();
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
          credentials: "include",
        });
        if (!res.ok) {
          logout();
          return null;
        }
        const data = (await res.json()) as {
          accessToken: string;
          refreshToken: string;
          tenantId?: string;
          clinicId?: string;
        };
        updateTokens(data.accessToken, data.refreshToken, {
          tenantId: data.tenantId ?? data.clinicId,
          clinicId: data.tenantId ?? data.clinicId,
        });
        return data.accessToken;
      } catch {
        logout();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, token, headers, _retried, ...rest } = options;
  const tenantId =
    useAuthStore.getState().tenantId ?? useAuthStore.getState().clinicId;

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: buildRequestHeaders(
      path,
      rest.method,
      token,
      tenantId,
      headers,
    ),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (
    response.status === 401 &&
    token &&
    !_retried &&
    !NO_REFRESH_PATHS.some((p) => path.startsWith(p))
  ) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequest<T>(path, { ...options, token: newToken, _retried: true });
    }
  }

  if (!response.ok) {
    let errorBody: ApiErrorBody & { status: number } = {
      status: response.status,
      message: `Request failed (${response.status})`,
    };
    try {
      const data = (await response.json()) as Record<string, unknown>;
      const nested =
        data.error && typeof data.error === "object"
          ? (data.error as ApiErrorBody)
          : null;

      const rawMessage = nested?.message ?? data.message;
      let message = errorBody.message;
      if (typeof rawMessage === "string" && rawMessage.trim()) {
        message = rawMessage;
      } else if (Array.isArray(rawMessage) && typeof rawMessage[0] === "string") {
        message = rawMessage[0];
      } else if (
        Array.isArray(nested?.details) &&
        typeof nested.details[0] === "string"
      ) {
        message = nested.details[0];
      }

      errorBody = {
        status: response.status,
        message,
        code:
          (typeof nested?.code === "string" ? nested.code : undefined) ??
          (typeof data.code === "string" ? data.code : undefined),
        suggestion:
          typeof nested?.suggestion === "string"
            ? nested.suggestion
            : typeof data.suggestion === "string"
              ? data.suggestion
              : undefined,
      };
    } catch {
      // non-JSON error body
    }
    throw new ApiError(
      errorBody.status,
      errorBody.message ?? "Request failed",
      errorBody.code,
      errorBody.suggestion,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export { API_BASE };

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  token: string,
): Promise<T> {
  const tenantId =
    useAuthStore.getState().tenantId ?? useAuthStore.getState().clinicId;

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
    },
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const data = (await response.json()) as {
        message?: string;
        error?: { message?: string };
      };
      message = data.error?.message ?? data.message ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}
