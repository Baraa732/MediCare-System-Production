import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, GripVertical } from "lucide-react";
import { useEditeMode } from "../../hooks/useEditeMode";
import { useScheduleContext } from "../../context/ScheduleContext";
import { useAppointmentDrawer } from "../../hooks/useAppointmentDrawer";
import type { PendingRequest } from "../../types";
import { formatDistanceToNow } from "date-fns";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement } from "@dnd-kit/modifiers";

export function PendingRequestSection() {
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const { appointments, doctors } = useScheduleContext();
  const [order, setOrder] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const requests: PendingRequest[] = useMemo(() => {
    const doctorMap = new Map(doctors.map((d) => [d.id, d.name]));
    const pending = appointments.filter((a) => a.status === "REQUESTED");

    const mapped = pending.map((apt) => {
      const date = new Date(apt.scheduledAt);
      return {
        id: apt.id,
        patientName: apt.reason || `Patient ${apt.patientId.slice(0, 8)}`,
        doctorName: doctorMap.get(apt.doctorId) ?? "Doctor",
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        timeAgo: formatDistanceToNow(date, { addSuffix: true }),
      };
    });

    if (order.length === 0) return mapped;

    const byId = new Map(mapped.map((r) => [r.id, r]));
    const ordered = order
      .map((id) => byId.get(id))
      .filter(Boolean) as PendingRequest[];
    const extras = mapped.filter((r) => !order.includes(r.id));
    return [...ordered, ...extras];
  }, [appointments, doctors, order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const ids = requests.map((r) => r.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex >= 0 && newIndex >= 0) {
      setOrder(arrayMove(ids, oldIndex, newIndex));
    }
  }

  const activeItem = requests.find((r) => r.id === activeId);

  return (
    <div className="flex-1 flex flex-col min-h-0 p-5">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Pending requests:
          </h4>
          <span className="bg-red-50 text-red-500 text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-red-100">
            {requests.length}
          </span>
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="text-xs text-neutral-400">No pending appointment requests.</p>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-neutral-200">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToParentElement]}
          >
            <SortableContext
              items={requests.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              {requests.map((item) => (
                <SortableRequestCard
                  key={item.id}
                  item={item}
                  isEditMode={isEditMode}
                />
              ))}
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {activeId && activeItem ? (
                <div className="bg-white border border-neutral-300 rounded-xl shadow-xl flex relative overflow-hidden min-h-[110px] w-full opacity-90 select-none pointer-events-none scale-[1.01] border-r-4 border-r-blue-500">
                  <div className="bg-neutral-50/80 border-r border-neutral-200 flex items-center justify-center shrink-0 w-9">
                    <GripVertical className="w-4 h-4 text-neutral-400 shrink-0" />
                  </div>
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0 text-right">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h5 className="text-xs font-bold text-neutral-900 truncate">
                          {activeItem.patientName}
                        </h5>
                        <p className="flex items-center text-[11px] text-neutral-400 font-medium mt-0.5 gap-1 truncate">
                          <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />{" "}
                          {activeItem.doctorName}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-[#0066ff] bg-blue-50/70 border border-blue-100 px-1.5 py-0.5 rounded-md shrink-0">
                        {activeItem.timeAgo}
                      </span>
                    </div>
                    <div className="flex flex-col justify-between text-[11px] font-semibold text-neutral-500 mt-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-neutral-400" />{" "}
                        {activeItem.date}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-neutral-400" />{" "}
                        {activeItem.time}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  );
}

interface SortableCardProps {
  item: PendingRequest;
  isEditMode: boolean;
}

function SortableRequestCard({ item, isEditMode }: SortableCardProps) {
  const openDrawer = useAppointmentDrawer((s) => s.open);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: !isEditMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border text-right transition-all duration-350 ease-in-out flex relative overflow-hidden min-h-[110px] ${
        isEditMode
          ? "border-neutral-300 rounded-xl shadow-xs"
          : "border-neutral-200 rounded-xl shadow-2xs hover:border-neutral-300"
      }`}
    >
      <div
        {...(isEditMode ? { ...attributes, ...listeners } : {})}
        className={`bg-neutral-50/80 border-r border-neutral-200 flex items-center justify-center shrink-0 transition-all duration-350 ease-in-out select-none ${
          isEditMode
            ? "w-9 opacity-100 scale-100 cursor-grab active:cursor-grabbing"
            : "w-0 opacity-0 scale-90 pointer-events-none border-r-transparent"
        }`}
      >
        <GripVertical
          className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-300 ${
            isEditMode ? "rotate-0 scale-100" : "-rotate-90 scale-75"
          }`}
        />
      </div>

      <div className="flex-1 p-3 flex flex-col justify-between min-w-0 transition-all duration-350">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <h5 className="text-xs font-bold text-neutral-900 truncate">
              {item.patientName}
            </h5>
            <p className="flex items-center text-[11px] text-neutral-400 font-medium mt-0.5 gap-1 truncate">
              <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />{" "}
              {item.doctorName}
            </p>
          </div>
          <span className="text-[10px] font-bold text-[#0066ff] bg-blue-50/70 border border-blue-100 px-1.5 py-0.5 rounded-md shrink-0">
            {item.timeAgo}
          </span>
        </div>

        <div className="flex flex-col justify-between text-[11px] font-semibold text-neutral-500 mt-2">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-neutral-400" /> {item.date}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-neutral-400" /> {item.time}
          </div>
        </div>

        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isEditMode
              ? "max-h-0 mt-0 opacity-0 pointer-events-none"
              : "max-h-12 mt-3 opacity-100"
          }`}
        >
          <Button
            className="w-full h-8 bg-[#39A3FF] hover:bg-[#258ce5] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
            onClick={() => openDrawer(item.id)}
          >
            Review
          </Button>
        </div>
      </div>
    </div>
  );
}
