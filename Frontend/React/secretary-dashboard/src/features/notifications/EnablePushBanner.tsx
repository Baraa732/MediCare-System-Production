import { Bell, Loader2 } from "lucide-react";
import { useNotifications } from "./NotificationProvider";

type EnablePushBannerProps = {
  compact?: boolean;
};

export function EnablePushBanner({ compact = false }: EnablePushBannerProps) {
  const {
    permission,
    pushEnabled,
    isEnabling,
    lastError,
    requestPushPermission,
  } = useNotifications();

  if (pushEnabled) {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
        <p className="text-xs font-semibold text-emerald-800">
          Browser push is on
        </p>
        <p className="mt-0.5 text-[11px] text-emerald-700">
          New bookings and status changes alert this browser. If the tab is
          open, a banner appears at the top of the dashboard immediately.
        </p>
      </div>
    );
  }

  if (permission === "unsupported") {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        This browser cannot receive web push. Use Chrome or Edge on HTTPS.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white px-4 py-3">
      <p className="text-xs font-semibold text-blue-950">
        Enable real browser notifications
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-blue-800">
        {compact
          ? "Allow this site so alerts arrive when the tab is hidden or the screen is locked."
          : "This uses Firebase Cloud Messaging. After you allow the browser prompt, this device is registered for secretary alerts (new requests, bookings, cancellations)."}
      </p>
      {permission === "denied" ? (
        <p className="mt-2 text-[11px] font-medium text-red-600">
          Notifications are blocked. Click the lock icon in the address bar →
          Site settings → Notifications → Allow, then press Enable again.
        </p>
      ) : null}
      {lastError ? (
        <p className="mt-2 text-[11px] font-medium text-red-600">{lastError}</p>
      ) : null}
      <button
        type="button"
        disabled={isEnabling || permission === "denied"}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void requestPushPermission();
        }}
        className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-[#0066ff] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0052cc] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isEnabling ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Connecting FCM…
          </>
        ) : (
          <>
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            Enable notifications
          </>
        )}
      </button>
    </div>
  );
}
