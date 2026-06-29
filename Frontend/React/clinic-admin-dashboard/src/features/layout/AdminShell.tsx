import { Outlet } from "react-router";
import { ClinicAdminProvider } from "@/context/ClinicAdminContext";
import { ProfileDrawer } from "@/features/profile/ProfileDrawer";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AdminShell() {
  return (
    <ClinicAdminProvider>
      <div className="flex h-screen w-screen bg-[#f3f2f1] overflow-hidden select-none font-sans text-[#1a1b1e] antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          <Header />
          <main className="flex-1 min-h-0 w-full overflow-y-auto">
            <div className="p-4 max-w-[1440px] mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
        <ProfileDrawer />
      </div>
    </ClinicAdminProvider>
  );
}
