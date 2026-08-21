import { createContext, useContext, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
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

type ScheduleDndContextValue = ReturnType<typeof useDragHandlers>;

const ScheduleDndContext = createContext<ScheduleDndContextValue | null>(null);

export function useScheduleDnd() {
  const ctx = useContext(ScheduleDndContext);
  if (!ctx) {
    throw new Error("useScheduleDnd must be used within ScheduleDndProvider");
  }
  return ctx;
}

export function ScheduleDndProvider({ children }: { children: ReactNode }) {
  const dnd = useDragHandlers();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
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
        <ConflictDrawer
          onClose={dnd.cancelConflict}
          onApplyResolution={dnd.confirmConflictResolution}
        />
      </DndContext>
    </ScheduleDndContext.Provider>
  );
}
