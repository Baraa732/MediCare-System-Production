import { getStatusOverlayClasses } from "@/features/dashboardAssitant/utils/appointmentStatusStyles";

export const getStatusOverlayStyles = (
  status?: string,
  options?: {
    startMinutes?: number;
    endMinutes?: number;
    nowMinutes?: number;
  },
): string => {
  return getStatusOverlayClasses(status, options);
};
