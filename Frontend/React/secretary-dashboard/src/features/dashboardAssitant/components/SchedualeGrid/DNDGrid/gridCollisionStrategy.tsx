import { closestCorners, type CollisionDetection } from "@dnd-kit/core";


// دالة تصادم مخصصة لحل مشكلة الـ position: sticky والـ Scroll العمودي
export const gridCollisionStrategy: CollisionDetection = (args) => {
  const { active, droppableContainers, pointerCoordinates } = args;

  // التحقق مما إذا كان العنصر المسحوب حالياً هو طبيب (أو عمود)
  const isActiveDoctor =
    active.data.current?.type === "doctor" || !!active.data.current?.sortable;

  if (isActiveDoctor) {
    if (!pointerCoordinates) return [];

    // فلترة الحاويات المستهدفة الخاصة بالأطباء فقط
    const doctorContainers = droppableContainers.filter(
      (c) => c.data.current?.type === "doctor" || !!c.data.current?.sortable,
    );

    // حساب المسافة الأفقية (X) فقط بين الماوس ومركز كل عمود
    const collisions = doctorContainers
      .map((container) => {
        const rect = container.rect.current;
        if (!rect) return { id: container.id, distance: Infinity };

        const centerX = rect.left + rect.width / 2;
        const distance = Math.abs(pointerCoordinates.x - centerX);
        return { id: container.id, distance };
      })
      .sort((a, b) => a.distance - b.distance); // ترتيبهم من الأقرب للأبعد أفقياً

    // إرجاع العمود الأقرب لمؤشر الماوس أفقياً
    return collisions.length > 0 && collisions[0].distance !== Infinity
      ? [{ id: collisions[0].id }]
      : [];
  }

  // في حال كان السحب لموعد (Appointment)، نعتمد closestCorners الافتراضية والدقيقة عمودياً
  return closestCorners(args);
};
