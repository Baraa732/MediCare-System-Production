import { useScheduleContext } from "../../context/ScheduleContext";

export function TitleSideBar() {
  const { clinicName } = useScheduleContext();

  return (
    <div className="h-16 px-5 border-b border-neutral-100 flex items-center gap-3">
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
    </div>
  );
}
