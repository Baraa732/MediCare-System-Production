import { cn } from "@/lib/utils";
import { DOCTOR_COL_WIDTH } from "../../data/scheduleGrid";
import type { DoctorType } from "../../types";

interface TopStickyHeaderProps {
  doctors: DoctorType[];
}

export function TopStickyHeader({ doctors }: TopStickyHeaderProps) {
  return (
    <div className="sticky top-0 z-40 flex divide-x divide-neutral-200 border-b border-neutral-200 bg-neutral-50">
      <div className="sticky left-0 z-50 h-16.25 w-24 shrink-0 border-r border-neutral-200 bg-neutral-100" />
      <div className="flex flex-1 divide-x divide-neutral-200">
        {doctors.map((doctor) => (
          <div key={doctor.id} className={cn(DOCTOR_COL_WIDTH)}>
            <div className="box-border flex h-16 w-full items-center justify-between bg-white p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={doctor.avatar}
                  alt={doctor.name}
                  className="h-9 w-9 shrink-0 rounded-xl border border-neutral-200/80 object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/defaults/default-doctor.jpg";
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-xs font-bold leading-none text-neutral-900">
                    {doctor.name}
                  </h4>
                  <p className="mt-1.5 text-[11px] font-semibold leading-none text-neutral-400">
                    {doctor.appointments.length} patients
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
