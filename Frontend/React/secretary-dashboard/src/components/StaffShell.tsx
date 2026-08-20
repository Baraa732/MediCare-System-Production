import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { useLogout } from "@/hooks/useLogout";
import { ScheduleProvider } from "@/features/dashboardAssitant/context/ScheduleContext";
import { AppointmentDetailDrawer } from "@/features/dashboardAssitant/components/AppointmentDetailDrawer";
import type { ReactNode } from "react";

export function StaffShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const logout = useLogout();

  return (
    <ScheduleProvider>
      <div className="flex h-screen w-screen bg-neutral-50 overflow-hidden font-sans text-neutral-900">
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-neutral-200 bg-white px-6 flex items-center gap-4 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-1.5 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" />
              Schedule
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold truncate">{title}</h1>
              {subtitle ? (
                <p className="text-[11px] text-neutral-500 truncate">{subtitle}</p>
              ) : null}
            </div>
            <NotificationBell />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => void logout()}
            >
              Log out
            </Button>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        <AppointmentDetailDrawer />
      </div>
    </ScheduleProvider>
  );
}
