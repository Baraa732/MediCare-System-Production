import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { DOCTOR_COL_WIDTH } from "../../data/scheduleGrid";
import { useEditeMode } from "../../hooks";
import { SortableDoctorHeader } from ".";
import type { DoctorWithApts } from "./DNDGrid";


export function TopStickyHeader({ doctors }: { doctors: DoctorWithApts[] }) {
  const isEditMode = useEditeMode((state) => state.isEditMode);
  return (
    <div className="sticky top-0 z-40 flex bg-neutral-50 border-b border-neutral-200 divide-x divide-neutral-200">
      {/* <div className="w-24 sticky left-0 z-50 bg-neutral-100 border-r border-neutral-200 shrink-0 h-[65px]" /> */}
      <div className="w-24 sticky left-0 z-50 bg-neutral-100 border-r border-neutral-200 shrink-0 h-16.25" />
      <div className="flex flex-1 divide-x divide-neutral-200">
        <SortableContext
          items={doctors.map((d) => d.id)}
          strategy={horizontalListSortingStrategy}
        >
          {doctors.map((doctor) => (
            <div key={doctor.id} className={cn(DOCTOR_COL_WIDTH)}>
              <SortableDoctorHeader
                id={doctor.id}
                doctor={doctor}
                disabled={!isEditMode}
              />
            </div>
          ))}
        </SortableContext>
      </div>
    </div>
  );
}