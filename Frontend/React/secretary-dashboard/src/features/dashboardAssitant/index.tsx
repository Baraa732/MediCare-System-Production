import { ScheduleProvider } from "./context/ScheduleContext";
import { Sidebar } from "./components/sidebar/main";
import { Header } from "./components/header/main";
import { ScheduleGrid } from "./components/SchedualeGrid/main";
import { AddAppointmentDialog } from "./components/AddAppointmentDialog";
import { AppointmentDetailDrawer } from "./components/AppointmentDetailDrawer";

export default function DashboardPage() {
  return (
    <ScheduleProvider>
      <div className="flex h-screen w-screen bg-neutral-50 overflow-hidden select-none font-sans text-neutral-900 antialiased">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          <Header />
          <main className="flex-1 min-h-0 w-full bg-white relative ">
            <ScheduleGrid />
          </main>
        </div>

        <AddAppointmentDialog />
        <AppointmentDetailDrawer />
      </div>
    </ScheduleProvider>
  );
}
