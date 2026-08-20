import {
  closestCorners,
  pointerWithin,
  type CollisionDetection,
} from "@dnd-kit/core";

export const gridCollisionStrategy: CollisionDetection = (args) => {
  const isSlot = (id: typeof args.droppableContainers[number]["id"]) =>
    args.droppableContainers.find((c) => c.id === id)?.data.current?.type ===
    "slot";

  const pointerHits = pointerWithin(args).filter((hit) => isSlot(hit.id));
  if (pointerHits.length > 0) return pointerHits;

  return closestCorners(args).filter((hit) => isSlot(hit.id));
};
