import { pointerWithin, type CollisionDetection } from "@dnd-kit/core";

/**
 * Only accept drops when the pointer is physically inside a grid slot.
 * Never snap to the nearest slot when the cursor is outside the grid
 * (that previously allowed "drop outside" to still move appointments).
 */
export const gridCollisionStrategy: CollisionDetection = (args) => {
  const isSlot = (id: (typeof args.droppableContainers)[number]["id"]) =>
    args.droppableContainers.find((c) => c.id === id)?.data.current?.type ===
    "slot";

  return pointerWithin(args).filter((hit) => isSlot(hit.id));
};
