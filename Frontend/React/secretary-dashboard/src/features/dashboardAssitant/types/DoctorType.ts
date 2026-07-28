import type { AppointmentType } from "./AppointmentType";

export  interface DoctorType {
  id: string;
  name: string;
  avatar: string;
  appointments: AppointmentType[];
  specialty: string;
}

