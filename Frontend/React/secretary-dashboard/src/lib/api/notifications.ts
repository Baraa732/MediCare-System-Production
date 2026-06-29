import { apiRequest } from "./client";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

export type StaffInboxItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  appointmentId?: string | null;
  clinicId?: string | null;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
};

export type StaffInboxResponse = {
  items: StaffInboxItem[];
  page: number;
  limit: number;
  total: number;
  unreadCount: number;
};

export async function fetchPushWebConfig(): Promise<FirebaseWebConfig | null> {
  try {
    const res = await apiRequest<{ success: boolean; config: FirebaseWebConfig }>(
      "/notifications/push/web-config",
    );
    return res.config ?? null;
  } catch {
    return null;
  }
}

export async function registerPushDevice(
  fcmToken: string,
  token: string,
  deviceLabel?: string,
): Promise<void> {
  await apiRequest("/notifications/push/register", {
    method: "POST",
    token,
    body: {
      fcmToken,
      platform: "web",
      deviceLabel,
    },
  });
}

export async function unregisterPushDevice(
  fcmToken: string,
  token: string,
): Promise<void> {
  await apiRequest("/notifications/push/register", {
    method: "DELETE",
    token,
    body: { fcmToken },
  });
}

export async function fetchStaffInbox(
  token: string,
  params?: { page?: number; limit?: number; unreadOnly?: boolean },
): Promise<StaffInboxResponse> {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.unreadOnly) search.set("unreadOnly", "true");

  const qs = search.toString();
  return apiRequest<StaffInboxResponse>(
    `/notifications/staff/inbox${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export async function markStaffInboxRead(
  notificationId: string,
  token: string,
): Promise<void> {
  await apiRequest(`/notifications/staff/inbox/${notificationId}/read`, {
    method: "PATCH",
    token,
  });
}

export async function markAllStaffInboxRead(token: string): Promise<void> {
  await apiRequest("/notifications/staff/inbox/read-all", {
    method: "PATCH",
    token,
  });
}
