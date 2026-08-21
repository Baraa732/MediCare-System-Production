import type { ColumnAppointmentsType, DoctorType } from "@/features/dashboardAssitant/types";

export type DoctorWithAppointments = Omit<DoctorType, "appointments"> & {
  appointments: ColumnAppointmentsType[];
};
