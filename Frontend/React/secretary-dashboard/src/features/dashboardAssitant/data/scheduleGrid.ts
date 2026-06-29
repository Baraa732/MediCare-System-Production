import type { DoctorType } from "../types";

export const INITIAL_DOCTORS: DoctorType[] = [
  {
    id: "doc-1",
    name: "Dr. Folan Alfolani",
    patients: 8,
    avatar: "https://i.pravatar.cc/150?img=33",
  },
  {
    id: "doc-2",
    name: "Dr. Alaa Al-Mansour",
    patients: 5,
    avatar: "https://i.pravatar.cc/150?img=12",
  },
  {
    id: "doc-3",
    name: "Dr. Tariq Al-Hassan",
    patients: 12,
    avatar: "https://i.pravatar.cc/150?img=60",
  },
  {
    id: "doc-4",
    name: "Dr. Yasmin Amari",
    patients: 6,
    avatar: "https://i.pravatar.cc/147?img=47",
  },
  {
    id: "doc-5",
    name: "Dr. Kamal Mustafa",
    patients: 9,
    avatar: "https://i.pravatar.cc/150?img=68",
  },
];

export const APPOINTMENTS = [
  {
    id: "apt-1",
    docId: "doc-1",
    title: "Folan Alfolani - Follow-up visit",
    start: 0,
    end: 45,
    status: "confirmed",
  },
  {
    id: "apt-2",
    docId: "doc-1",
    title: "Khalid Mansour - Consultation",
    start: 60,
    end: 120,
    status: "urgent",
  },
  {
    id: "apt-3",
    docId: "doc-2",
    title: "Sarah Ahmed - Blood Test Result",
    start: 30,
    end: 75,
    status: "in_progress",
  },
  {
    id: "apt-4",
    docId: "doc-3",
    title: "Unavailable - Hospital Round",
    start: 120,
    end: 180,
    status: "unavailable",
  },
  {
     id: "apt-5",
    docId: "doc-1",
    title: "Unavailable - Hospital Round",
    start: 800,
    end: 860,
    status: "unavailable",
  },
];

export const informationPanelData = [
  {
    name: "Confirmed",
    border: "border-blue-300",
    bg: "bg-[#E2F1FF]",
  },
  {
    name: "Done/Checked-In",
    border: "border-green-300",
    bg: "bg-green-50",
  },
  {
    name: "In progress",
    border: "border-purple-300",
    bg: "bg-purple-50",
  },
  { name: "Late", border: "border-amber-300", bg: "bg-amber-50" },
  {
    name: "Pending request",
    border: "border-red-200",
    bg: "bg-red-50/50",
  },
  { name: "No-Show", border: "border-red-300", bg: "bg-red-50" },
];

export const ROW_MINUTES = 15;
export const START_TIME_MINUTES = 9 * 60; // 9:00 AM
export const TOTAL_HOURS = 24;
export const TOTAL_SLOTS = (TOTAL_HOURS * 60) / ROW_MINUTES;
export const SLOT_HEIGHT = 44;
export const DOCTOR_COL_WIDTH = "min-w-[350px] max-w-[400px] flex-1";
