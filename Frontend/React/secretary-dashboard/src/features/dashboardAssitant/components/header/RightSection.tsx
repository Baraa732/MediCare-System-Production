import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { logout as logoutApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/authStore";
import { useScheduleContext } from "@/features/dashboardAssitant/context/ScheduleContext";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { Download, LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router";

function downloadScheduleCsv(
  appointments: Array<{
    scheduledAt: string;
    durationMinutes: number;
    status: string;
    doctorId: string;
    patientId: string;
    reason?: string;
  }>,
  doctors: Array<{ id: string; name: string }>,
  date: Date,
) {
  const doctorMap = new Map(doctors.map((d) => [d.id, d.name]));
  const header = "Time,Duration,Status,Doctor,Patient ID,Reason\n";
  const rows = appointments
    .map((apt) => {
      const time = new Date(apt.scheduledAt).toLocaleString();
      const doctor = doctorMap.get(apt.doctorId) ?? apt.doctorId;
      const reason = (apt.reason ?? "").replace(/"/g, '""');
      return `"${time}",${apt.durationMinutes},"${apt.status}","${doctor}","${apt.patientId}","${reason}"`;
    })
    .join("\n");

  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `schedule-${date.toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function RightSection() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const { appointments, doctors, selectedDate } = useScheduleContext();

  const initials =
    role === "SECRETARY"
      ? "SC"
      : role.slice(0, 2).toUpperCase() || "U";

  const handleLogout = () => {
    if (accessToken && refreshToken) {
      void logoutApi(refreshToken, accessToken).catch(() => {
        // Still clear local session if the server call fails.
      });
    }

    logout();
    navigate("/auth/login", { replace: true });
  };

  const handleDownload = () => {
    downloadScheduleCsv(appointments, doctors, selectedDate);
  };

  return (
    <div className="flex items-center gap-4">
      <Button
        type="button"
        onClick={handleDownload}
        className="h-9.5 bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-bold rounded-xl px-4 flex items-center gap-1.5 shadow-sm"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Download schedule</span>
      </Button>

      <NotificationBell />

      <Button
        type="button"
        variant="outline"
        onClick={() => navigate("/dashboard/settings")}
        className="h-9.5 rounded-xl border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 px-3 gap-1.5"
      >
        <Settings className="w-3.5 h-3.5" />
        Settings
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={handleLogout}
        className="h-9.5 rounded-xl border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 px-3 gap-1.5"
      >
        <LogOut className="w-3.5 h-3.5" />
        Logout
      </Button>

      <button
        type="button"
        onClick={() => navigate("/dashboard/settings")}
        className="rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200"
        title="Profile settings"
      >
        <Avatar className="w-9.5 h-9.5 rounded-xl border border-neutral-200">
          <AvatarImage src="" />
          <AvatarFallback className="rounded-xl font-bold bg-[#0066ff] text-white text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>
    </div>
  );
}
