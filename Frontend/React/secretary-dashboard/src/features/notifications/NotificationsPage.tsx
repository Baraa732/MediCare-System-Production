import { formatDistanceToNow } from "date-fns";
import { BellRing, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffShell } from "@/components/StaffShell";
import { EnablePushBanner } from "./EnablePushBanner";
import { useNotifications } from "./NotificationProvider";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router";
import { useAppointmentDrawer } from "@/features/dashboardAssitant/hooks/useAppointmentDrawer";
import { useHandleDatePicker } from "@/features/dashboardAssitant/hooks/useHandleDatePicker";

export function NotificationsPage() {
  const navigate = useNavigate();
  const openAppointment = useAppointmentDrawer((s) => s.open);
  const changeDate = useHandleDatePicker((s) => s.handleChangeDate);
  const {
    items,
    unreadCount,
    pushEnabled,
    isLoading,
    markRead,
    markAllRead,
    refreshInbox,
  } = useNotifications();

  return (
    <StaffShell
      title="Notifications"
      subtitle={
        pushEnabled
          ? "Firebase Cloud Messaging is connected for this browser"
          : "Enable browser push to receive alerts when this tab is hidden"
      }
    >
      <div className="mx-auto w-full max-w-3xl space-y-5 p-6">
        <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#0066ff]">
              <BellRing className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold">Browser push</h2>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Inbox rows are saved on the server. Phone/desktop alerts only appear
                after this browser is registered with FCM.
              </p>
            </div>
          </div>
          <EnablePushBanner />
        </div>

        <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold">Inbox</h2>
              <p className="text-[11px] text-neutral-500">
                {unreadCount} unread · {items.length} loaded
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => void refreshInbox()}
              >
                Refresh
              </Button>
              {unreadCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl bg-[#0066ff] hover:bg-[#0052cc]"
                  onClick={() => void markAllRead()}
                >
                  <CheckCheck className="mr-1 h-3.5 w-3.5" />
                  Mark all read
                </Button>
              ) : null}
            </div>
          </div>

          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading inbox…
            </div>
          ) : items.length === 0 ? (
            <p className="px-5 py-16 text-center text-sm text-neutral-400">
              No notifications yet. New patient bookings will appear here.
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
                        "w-full px-5 py-4 text-left transition-colors hover:bg-neutral-50",
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
                        navigate("/dashboard");
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-neutral-900">
                          {item.title}
                        </p>
                        {unread ? (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0066ff]" />
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-neutral-600">{item.body}</p>
                      <p className="mt-2 text-[11px] text-neutral-400">
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
        </section>
      </div>
    </StaffShell>
  );
}
