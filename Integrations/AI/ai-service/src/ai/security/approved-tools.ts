export const APPROVED_BOOKING_TOOLS = [
  'search_clinics',
  'list_doctors',
  'get_available_slots',
  'book_appointment',
  'modify_appointment',
  'get_upcoming_appointments',
  'cancel_appointment',
] as const;

export type ApprovedBookingTool = (typeof APPROVED_BOOKING_TOOLS)[number];
