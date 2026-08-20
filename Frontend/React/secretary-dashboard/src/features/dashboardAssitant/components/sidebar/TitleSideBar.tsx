import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScheduleContext } from "../../context/ScheduleContext";
import { useLogout } from "@/hooks/useLogout";

export function TitleSideBar() {
  const { clinicName } = useScheduleContext();
  const logout = useLogout();

  return (
    <div className="h-16 px-5 border-b border-neutral-100 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-sm font-black text-white shadow-sm">
          M
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold tracking-tight text-neutral-900 leading-none truncate">
            {clinicName ?? "MediCare Clinic"}
          </span>
          <span className="text-[11px] text-neutral-400 font-medium mt-0.5">
            Secretary · your clinic only
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void logout()}
        className="h-8 px-2.5 rounded-lg text-[11px] font-bold text-red-600 border-red-100 hover:bg-red-50 shrink-0"
        title="Log out"
      >
        <LogOut className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
