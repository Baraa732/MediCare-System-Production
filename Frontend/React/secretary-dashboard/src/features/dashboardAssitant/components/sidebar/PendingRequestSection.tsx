import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, GripVertical } from "lucide-react";
import { useEditeMode } from "../../hooks/useEditeMode";

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

// 1. استيراد المُعدّل المسؤول عن تقييد حركة السحب عمودياً فقط
import { restrictToParentElement } from "@dnd-kit/modifiers";
import type { PendingRequest } from "../../types";

import { useWizardDrawer } from "../../hooks/useWizardDrawer";
import { usePendingRequest } from "../../hooks/usePendingRequest";
import { useScheduleContext } from "../../context/ScheduleContext";
import { formatMinutesToAMPM } from "../SchedualeGrid/DNDGrid/utils/timeFormatters";

export function PendingRequestSection() {
  const isEditMode = useEditeMode((state) => state.isEditMode);
  const [activeId, setActiveId] = useState<string | null>(null);
  // const [requests, setRequests] = useState(INITIAL_REQUESTS)
  const requests = usePendingRequest((state) => state.requests);
  const setRequests = usePendingRequest((state) => state.setRequests);
  const { doctors } = useScheduleContext();

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

    if (!over) return;

    if (active.id !== over.id) {
      const newRquests = (items: PendingRequest[]): PendingRequest[] => {
        const oldIndex: number = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      };
      setRequests(newRquests(requests));
    }
  }

  const activeItem = requests.find((r) => r.id === activeId);

  if (requests.length == 0) return null;

  const doctor = doctors.find((doc) => doc.id == activeItem?.docId);
  return (
    <div className="flex-1 flex flex-col min-h-0 p-5">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Pending requests:
          </h4>
          {requests.length == 0 ? null : (
            <span className="bg-red-50 text-red-500 text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-red-100">
              {requests.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-neutral-200">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          // 2. تمرير المُعدّل هنا لمنع الكارت الطائر من الخروج أفقياً نهائياً خارج الحاوية الجانبية
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
                        {activeItem.patient.name}
                      </h5>
                      <p className="flex items-center text-[11px] text-neutral-400 font-medium mt-0.5 gap-1 truncate">
                        <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />{" "}
                        {doctor?.name}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-[#0066ff] bg-blue-50/70 border border-blue-100 px-1.5 py-0.5 rounded-md shrink-0">
                      {formatTimeAgo(activeItem.timeRequistAgo)}
                    </span>
                  </div>
                  <div className="flex flex-col justify-between text-[11px] font-semibold text-neutral-500 mt-2">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-neutral-400" />{" "}
                      {activeItem.date.toDateString()}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-neutral-400" />{" "}
                      {formatMinutesToAMPM(activeItem.start)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

interface SortableCardProps {
  item: PendingRequest;
  isEditMode: boolean;
}

function formatTimeAgo(minutesAgo: number): string {
  if (minutesAgo <= 0) return "now";
  // إذا كان الوقت أقل من ساعة (60 دقيقة)
  if (minutesAgo < 60) return `${minutesAgo} Min Ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  // إذا كان الوقت أقل من يوم (1440 دقيقة)
  if (hoursAgo < 24) return `${hoursAgo} Hours Ago`;
  const daysAgo = Math.floor(hoursAgo / 24);
  return `${daysAgo} Day Ago`;
}

function SortableRequestCard({ item, isEditMode }: SortableCardProps) {
  const openWithPendingRequest = useWizardDrawer(
    (state) => state.openWithPendingRequest,
  );
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

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { doctors } = useScheduleContext();
  const doctor = doctors.find((doc) => doc.id == item.docId);

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
              {item.patient.name}
            </h5>
            <p className="flex items-center text-[11px] text-neutral-400 font-medium mt-0.5 gap-1 truncate">
              <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />{" "}
              {doctor?.name}
            </p>
          </div>
          <span className="text-[10px] font-bold text-[#0066ff] bg-blue-50/70 border border-blue-100 px-1.5 py-0.5 rounded-md shrink-0">
            {formatTimeAgo(item.timeRequistAgo)}
          </span>
        </div>

        <div className="flex flex-col justify-between text-[11px] font-semibold text-neutral-500 mt-2">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-neutral-400" />{" "}
            {item.date.toDateString()}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-neutral-400" />{" "}
            {formatMinutesToAMPM(item.start)}
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
            onClick={() => openWithPendingRequest(item)} // ربط الأكشن هنا 🔥
          >
            Review
          </Button>
        </div>
      </div>
    </div>
  );
}
