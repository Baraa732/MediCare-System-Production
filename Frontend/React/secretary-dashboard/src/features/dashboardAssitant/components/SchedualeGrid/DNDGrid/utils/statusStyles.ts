const STATUS_STYLES = {
  urgent: "bg-[#FFF2ED] border-orange-300 text-orange-800",
  in_progress: "bg-purple-50 border-purple-300 text-purple-800",
  unavailable: "bg-neutral-50 border-neutral-300 text-neutral-500 border-dashed",
  confirmed: "bg-[#E2F1FF] border-blue-300 text-[#0055cc]",
} as const;

export const getStatusOverlayStyles = (status?: string): string => {
  return STATUS_STYLES[status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.confirmed;
};