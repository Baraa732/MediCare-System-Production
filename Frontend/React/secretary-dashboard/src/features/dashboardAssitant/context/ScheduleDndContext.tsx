import { createContext, useContext, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { gridCollisionStrategy } from "../components/SchedualeGrid/DNDGrid";
import { useDragHandlers } from "../components/SchedualeGrid/DNDGrid/hooks/useDragHandlers";
import { DragOverlayCard } from "../components/SchedualeGrid/DNDGrid/DragOverlayCard";
import { AppointmentUpdateToast } from "../components/SchedualeGrid/AppointmentUpdateToast";
import { AppointmentContextMenu } from "../components/SchedualeGrid/DNDGrid/AppointmentContextMenu";
import { AppointmentWizardDrawer } from "../CreateAppointmentWizard/AppointmentWizardDrawer";
import { ConflictDrawer } from "../components/SchedualeGrid/ConflictDrawer";
import type { PendingRequest } from "../types";

type ScheduleDndContextValue = ReturnType<typeof useDragHandlers>;

const ScheduleDndContext = createContext<ScheduleDndContextValue | null>(null);

export function useScheduleDnd() {
  const ctx = useContext(ScheduleDndContext);
  if (!ctx) {
    throw new Error("useScheduleDnd must be used within ScheduleDndProvider");
  }
  return ctx;
}

function PendingDragOverlay({ request }: { request: PendingRequest }) {
  return (
    <div className="flex min-h-[80px] w-[220px] overflow-hidden rounded-xl border border-blue-200 bg-white shadow-xl opacity-95">
      <div className="flex flex-1 flex-col justify-center p-3">
        <p className="truncate text-xs font-bold text-neutral-900">
          {request.patient?.name ?? request.title ?? "Pending request"}
        </p>
        <p className="mt-1 text-[10px] font-semibold text-blue-600">
          Drop on an empty slot
        </p>
      </div>
    </div>
  );
}

export function ScheduleDndProvider({ children }: { children: ReactNode }) {
  const dnd = useDragHandlers();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  return (
    <ScheduleDndContext.Provider value={dnd}>
      <DndContext
        sensors={sensors}
        collisionDetection={gridCollisionStrategy}
        onDragStart={dnd.handleDragStart}
        onDragOver={dnd.handleDragOver}
        onDragEnd={dnd.handleDragEnd}
      >
        {children}

        <DragOverlay dropAnimation={null}>
          {dnd.activeId && dnd.activeType === "appointment" && dnd.activeData ? (
            <DragOverlayCard
              data={dnd.activeData}
              height={dnd.overlayMeta.cardHeight}
            />
          ) : null}
          {dnd.activeId &&
          dnd.activeType === "pending_request" &&
          dnd.activeData?.pendingRequestData ? (
            <PendingDragOverlay request={dnd.activeData.pendingRequestData} />
          ) : null}
        </DragOverlay>

        <AppointmentContextMenu
          doctors={dnd.doctors}
          onExecuteAction={dnd.updateAppointment}
        />

        <AppointmentUpdateToast
          isOpen={dnd.isToastOpen}
          patientName={dnd.toastInfo.patientName}
          newTimeLabel={dnd.toastInfo.newTimeLabel}
          onClose={dnd.closeToast}
          onUndo={dnd.handleUndoAction}
        />

        <AppointmentWizardDrawer doctors={dnd.doctors} />
        <ConflictDrawer onClose={dnd.cancelConflict} />
      </DndContext>
    </ScheduleDndContext.Provider>
  );
}
