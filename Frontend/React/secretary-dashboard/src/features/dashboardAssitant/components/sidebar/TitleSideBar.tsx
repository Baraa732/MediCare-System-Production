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
        <div className="w-7 h-7 rounded-lg bg-[#0066ff] text-white flex items-center justify-center font-black text-base shrink-0">
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
