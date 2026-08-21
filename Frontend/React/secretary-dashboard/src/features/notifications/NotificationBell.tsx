import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  Loader2,
  Phone,
  Settings2,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "./NotificationProvider";
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
  { id: "guest_call", label: "Call guest" },
] as const;

function isGuestCall(item: { title?: string; data?: Record<string, unknown> | null }) {
  return (
    item.data?.guestCallRequired === true ||
    item.data?.guestCallRequired === "true" ||
    (item.title || "").toLowerCase().includes("call guest")
  );
}

function categoryIcon(category: string, guestCall?: boolean) {
  if (guestCall) return Phone;
  if (category.includes("CANCEL")) return CalendarClock;
  if (category.includes("REQUEST")) return Sparkles;
  if (category.includes("CREATE")) return BellRing;
  return Bell;
}

function categoryAccent(category: string, guestCall?: boolean) {
  if (guestCall) return "text-amber-700 bg-amber-50";
  if (category.includes("CANCEL")) return "text-red-600 bg-red-50";
  if (category.includes("REQUEST")) return "text-violet-600 bg-violet-50";
  if (category.includes("CREATE")) return "text-emerald-600 bg-emerald-50";
  if (category.includes("UPDATE")) return "text-blue-600 bg-blue-50";
  return "text-neutral-600 bg-neutral-100";
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
    refreshInbox,
    markRead,
    markAllRead,
    requestPushPermission,
    isEnabling,
  } = useNotifications();

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((i) => !i.readAt);
    if (filter === "guest_call") return items.filter((i) => isGuestCall(i));
    return items.filter((i) => i.category === filter);
  }, [filter, items]);

  return (
    <Popover onOpenChange={(open) => open && void refreshInbox()}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Notifications"
          className="relative flex h-9.5 w-9.5 cursor-pointer items-center justify-center rounded-xl border border-neutral-200/80 bg-white/80 text-neutral-600 backdrop-blur-sm transition-all duration-200 hover:-translate-y-px hover:bg-neutral-50"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-0 shadow-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="border-b border-neutral-100 bg-gradient-to-br from-slate-50 to-white px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold tracking-tight text-neutral-900">
                Notifications
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                {unreadCount > 0
                  ? `${unreadCount} unread alert${unreadCount === 1 ? "" : "s"}`
                  : "You're all caught up"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg px-2 text-[11px] font-semibold"
                  onClick={() => void markAllRead()}
                >
                  <CheckCheck className="mr-1 h-3.5 w-3.5" />
                  Read all
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-lg"
                onClick={() => navigate("/dashboard/notifications")}
                title="Open full inbox"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {!pushEnabled ? (
            <button
              type="button"
              disabled={isEnabling}
              onClick={() => void requestPushPermission()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-60"
            >
              <BellRing className="h-3.5 w-3.5" />
              {isEnabling ? "Connecting push…" : "Enable browser alerts"}
            </button>
          ) : (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Browser push active
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-1 overflow-x-auto border-b border-neutral-100 px-3 py-2 no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                filter === f.id
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="max-h-[min(22rem,50vh)] overflow-y-auto scrollbar-thin">
          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading inbox…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Bell className="mx-auto mb-2 h-8 w-8 text-neutral-200" />
              <p className="text-xs font-medium text-neutral-500">
                No notifications here
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 p-2">
              {filtered.map((item) => {
                const unread = !item.readAt;
                const guestCall = isGuestCall(item);
                const Icon = categoryIcon(item.category, guestCall);
                const accent = categoryAccent(item.category, guestCall);
                const phone =
                  typeof item.data?.guestPatientPhone === "string"
                    ? item.data.guestPatientPhone
                    : typeof item.data?.telLink === "string"
                      ? item.data.telLink.replace(/^tel:/, "")
                      : null;
                return (
                  <li key={item.id}>
                    <div
                      className={cn(
                        "flex w-full gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-neutral-50",
                        unread && "bg-blue-50/30",
                        guestCall && "bg-amber-50/40",
                      )}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 gap-3 text-left"
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
                        <span
                          className={cn(
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                            accent,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-neutral-900">
                              {item.title}
                            </span>
                            {unread ? (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                            ) : null}
                          </span>
                          <span className="mt-0.5 block line-clamp-2 text-[11px] leading-relaxed text-neutral-600">
                            {item.body}
                          </span>
                          <span className="mt-1 block text-[10px] text-neutral-400">
                            {formatDistanceToNow(new Date(item.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </span>
                      </button>
                      {guestCall && phone ? (
                        <a
                          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                          className="btn-brand mt-0.5 flex h-9 shrink-0 items-center gap-1 rounded-xl px-2.5 text-[10px] font-bold text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="h-3 w-3" />
                          Call
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-neutral-100 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full rounded-xl text-xs font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            onClick={() => navigate("/dashboard/notifications")}
          >
            Open full notifications page
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
