import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "./NotificationProvider";
import { EnablePushBanner } from "./EnablePushBanner";
import { cn } from "@/lib/utils";
import { useAppointmentDrawer } from "@/features/dashboardAssitant/hooks/useAppointmentDrawer";
import { useHandleDatePicker } from "@/features/dashboardAssitant/hooks/useHandleDatePicker";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "APPOINTMENT_REQUESTED", label: "Requests" },
  { id: "APPOINTMENT_CREATED", label: "Booked" },
  { id: "APPOINTMENT_UPDATED", label: "Updated" },
  { id: "APPOINTMENT_CANCELLED", label: "Cancelled" },
] as const;

function categoryTone(category: string) {
  if (category.includes("CANCEL")) return "border-l-red-500";
  if (category.includes("REQUEST") || category.includes("UPDATE"))
    return "border-l-amber-500";
  if (category.includes("CREATE")) return "border-l-emerald-500";
  return "border-l-blue-500";
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const openAppointment = useAppointmentDrawer((s) => s.open);
  const changeDate = useHandleDatePicker((s) => s.handleChangeDate);
  const {
    items,
    unreadCount,
    pushEnabled,
    isLoading,
    lastError,
    refreshInbox,
    markRead,
    markAllRead,
  } = useNotifications();

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((i) => !i.readAt);
    return items.filter((i) => i.category === filter);
  }, [filter, items]);

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

      <PopoverContent
        align="end"
        className="w-[28rem] p-0 overflow-hidden rounded-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Notifications</p>
            <p className="text-[11px] text-neutral-500">
              {pushEnabled ? "FCM connected" : "Inbox only · push off"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => void markAllRead()}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => navigate("/dashboard/notifications")}
            >
              Open
            </Button>
          </div>
        </div>

        <div className="px-3 py-3 border-b border-neutral-100">
          <EnablePushBanner compact />
        </div>

        {lastError && !pushEnabled ? null : lastError && pushEnabled ? (
          <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700">
            {lastError}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-neutral-100">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-2 py-1 rounded-full text-[11px] border transition-colors",
                filter === f.id
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "border-neutral-200 text-neutral-500 hover:bg-neutral-50",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-neutral-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-xs text-neutral-400">
              No notifications in this view
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {filtered.map((item) => {
                const unread = !item.readAt;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors border-l-2",
                        categoryTone(item.category),
                        unread && "bg-blue-50/40",
                      )}
                      onClick={() => {
                        if (unread) void markRead(item.id);
                        const scheduled = item.data?.scheduledAt;
                        if (typeof scheduled === "string") {
                          changeDate(new Date(scheduled));
                        }
                        if (item.appointmentId) {
                          openAppointment(item.appointmentId);
                        }
                      }}
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
                        {item.category.replace(/_/g, " ").toLowerCase()} ·{" "}
                        {formatDistanceToNow(new Date(item.createdAt), {
                          addSuffix: true,
                        })}
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
