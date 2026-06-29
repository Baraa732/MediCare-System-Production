import { Outlet } from "react-router";
import { ClinicAdminProvider } from "@/context/ClinicAdminContext";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AdminShell() {
  return (
    <ClinicAdminProvider>
      <div className="flex h-screen w-screen bg-neutral-50 overflow-hidden select-none font-sans text-neutral-900 antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          <Header />
          <main className="flex-1 min-h-0 w-full overflow-y-auto bg-neutral-50">
            <div className="p-6 max-w-[1600px] mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ClinicAdminProvider>
  );
}
