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
  /** Short secretary note shown on the grid card. */
  notes?: string;
  complexity?: "standard" | "complex" | "elderly" | "urgent";
  refuseTransfer?: boolean;
  patient?: {
    name: string;
    age: number;
    phone: string;
    gender: "Male" | "Female" | null;
    adddress: string;
  };
}
