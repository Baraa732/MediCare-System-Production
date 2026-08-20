/** Grid cell appointment shape returned from the MediCare API mappers. */
export interface ColumnAppointmentsType {
  id: string;
  docId: string;
  title: string;
  start: number;
  end: number;
  status: string;
  date?: Date;
  duration?: number;
  patient?: {
    name: string;
    age: number;
    phone: string;
    gender: "Male" | "Female" | null;
    adddress: string;
  };
}
