import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { useLogout } from "@/hooks/useLogout";
import { ScheduleProvider } from "@/features/dashboardAssitant/context/ScheduleContext";
import { AppointmentDetailDrawer } from "@/features/dashboardAssitant/components/AppointmentDetailDrawer";
import { PageTransition } from "@/components/motion/PageTransition";
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
      <div className="flex h-screen w-screen overflow-hidden bg-[linear-gradient(180deg,#f4f7fb_0%,#eef3fa_100%)] font-sans text-neutral-900">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass-header gpu-layer flex h-16 shrink-0 items-center gap-4 px-5 sm:px-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-1.5 rounded-xl border-neutral-200/80 bg-white/70 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-px"
            >
              <ArrowLeft className="h-4 w-4" />
              Schedule
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold tracking-tight">{title}</h1>
              {subtitle ? (
                <p className="truncate text-[11px] text-neutral-500">{subtitle}</p>
              ) : null}
            </div>
            <NotificationBell />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-neutral-200/80 bg-white/70 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-px"
              onClick={() => void logout()}
            >
              Log out
            </Button>
          </header>
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <PageTransition className="h-full">{children}</PageTransition>
          </main>
        </div>
        <AppointmentDetailDrawer />
      </div>
    </ScheduleProvider>
  );
}
