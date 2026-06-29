import { parseApiErrorPayload } from "./errors";
import { ApiError, type ApiErrorBody } from "./types";
import { useAuthStore } from "@/stores/authStore";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

const NO_REFRESH_PATHS = [
  "/auth/login",
  "/auth/refresh-token",
  "/auth/register",
  "/auth/verify-otp",
  "/auth/verify-mfa",
  "/auth/staff/complete-activation",
  "/auth/forgot-password/send-otp",
  "/auth/forgot-password/verify-otp",
  "/auth/reset-password",
];

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
  /** Internal: skip refresh retry (prevents infinite loops). */
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
          userId?: string;
          role?: string;
          tenantId?: string;
          clinicId?: string;
        };

        updateTokens(data.accessToken, data.refreshToken, {
          userId: data.userId,
          role: data.role,
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

async function parseError(response: Response): Promise<ApiErrorBody & { status: number }> {
  try {
    const data = await response.json();
    const parsed = parseApiErrorPayload(data);

    if (parsed) {
      return {
        status: response.status,
        code: parsed.code ?? "REQUEST_FAILED",
        message: parsed.message ?? `Request failed (${response.status})`,
        suggestion: parsed.suggestion,
      };
    }
  } catch {
    // Response body is not JSON.
  }

  return {
    status: response.status,
    code: "REQUEST_FAILED",
    message: `Request failed (${response.status})`,
  };
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
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
      ...headers,
    },
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
    const errorBody = await parseError(response);
    throw new ApiError(
      response.status,
      errorBody.message ?? `Request failed (${response.status})`,
      errorBody.code,
      errorBody.suggestion,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export { API_BASE };
