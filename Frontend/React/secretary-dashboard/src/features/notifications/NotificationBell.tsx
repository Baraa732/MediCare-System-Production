import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "./NotificationProvider";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const {
    items,
    unreadCount,
    permission,
    pushEnabled,
    isLoading,
    refreshInbox,
    markRead,
    markAllRead,
    requestPushPermission,
  } = useNotifications();

  const needsPermission =
    permission === "default" || (permission === "granted" && !pushEnabled);

  return (
    <Popover onOpenChange={(open) => open && void refreshInbox()}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Notifications"
          className="w-9.5 h-9.5 rounded-xl border border-neutral-200 flex items-center justify-center relative hover:bg-neutral-50 text-neutral-600 transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Notifications</p>
            <p className="text-[11px] text-neutral-500">
              Real-time alerts for appointments
            </p>
          </div>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>

        {needsPermission ? (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <p className="text-xs text-blue-900 mb-2">
              Enable browser notifications to receive alerts when this tab is in the
              background, minimized, or your screen is locked.
            </p>
            <Button
              type="button"
              size="sm"
              className="h-8 bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs"
              onClick={() => void requestPushPermission()}
            >
              Enable notifications
            </Button>
          </div>
        ) : null}

        <div className="max-h-80 overflow-y-auto">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-neutral-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-xs text-neutral-400">
              No notifications yet
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {items.map((item) => {
                const unread = !item.readAt;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors",
                        unread && "bg-blue-50/40",
                      )}
                      onClick={() => unread && void markRead(item.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-neutral-900">
                          {item.title}
                        </p>
                        {unread ? (
                          <span className="mt-1 w-2 h-2 rounded-full bg-[#0066ff] shrink-0" />
                        ) : null}
                      </div>
                      <p className="text-[11px] text-neutral-600 mt-0.5 line-clamp-2">
                        {item.body}
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
