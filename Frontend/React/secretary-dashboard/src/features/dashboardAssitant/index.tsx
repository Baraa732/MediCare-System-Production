import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import { PageTransition } from "@/components/motion/PageTransition";
import { ScheduleProvider } from "./context/ScheduleContext";
import { Sidebar } from "./components/sidebar/main";
import { Header } from "./components/header/main";
import { ScheduleGrid } from "./components/SchedualeGrid/main";
import { AddAppointmentDialog } from "./components/AddAppointmentDialog";
import { AppointmentDetailDrawer } from "./components/AppointmentDetailDrawer";

export default function DashboardPage() {
  return (
    <DashboardErrorBoundary>
      <ScheduleProvider>
        <PageTransition className="flex h-screen w-screen overflow-hidden bg-[linear-gradient(180deg,#f4f7fb_0%,#eef3fa_100%)] font-sans text-neutral-900 antialiased select-none">
          <Sidebar />

          <div className="relative flex h-full min-w-0 flex-1 flex-col">
            <Header />
            <main className="relative min-h-0 w-full flex-1 p-2 sm:p-3">
              <div className="surface-card gpu-layer h-full overflow-hidden contain-layout">
                <ScheduleGrid />
              </div>
            </main>
          </div>

          <AddAppointmentDialog />
          <AppointmentDetailDrawer />
        </PageTransition>
      </ScheduleProvider>
    </DashboardErrorBoundary>
  );
}
