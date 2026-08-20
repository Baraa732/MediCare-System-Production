import { Bell, X } from "lucide-react";
import { useNotifications } from "./NotificationProvider";

export function LivePushToast() {
  const { liveAlert, dismissLiveAlert } = useNotifications();

  if (!liveAlert) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center px-4">
      <div className="toast-enter pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl border border-blue-200/80 bg-white/95 px-4 py-3 shadow-xl shadow-blue-900/10 backdrop-blur-md">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white">
          <Bell className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-neutral-900">{liveAlert.title}</p>
          {liveAlert.body ? (
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
              {liveAlert.body}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-blue-600">
            Check pending requests in the sidebar
          </p>
        </div>
        <button
          type="button"
          onClick={dismissLiveAlert}
          className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
