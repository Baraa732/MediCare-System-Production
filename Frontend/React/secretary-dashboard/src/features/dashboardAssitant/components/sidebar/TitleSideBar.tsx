import { useScheduleContext } from "../../context/ScheduleContext";

function clinicInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "C";
  return trimmed.charAt(0).toUpperCase();
}

export function TitleSideBar() {
  const { clinicName, loading } = useScheduleContext();
  const displayName = clinicName?.trim() || (loading ? "Loading clinic…" : "Your clinic");

  return (
    <div className="h-16 px-5 border-b border-neutral-100 flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 shrink-0 rounded-lg bg-[#0066ff] text-white flex items-center justify-center font-black text-base">
          {clinicInitial(displayName)}
        </div>
        <div className="flex flex-col min-w-0">
          <span
            className="text-sm font-bold tracking-tight text-neutral-900 leading-none truncate"
            title={displayName}
          >
            {displayName}
          </span>
          <span className="text-[11px] text-neutral-400 font-medium mt-0.5">
            Secretary dashboard
          </span>
        </div>
      </div>
    </div>
  );
}
