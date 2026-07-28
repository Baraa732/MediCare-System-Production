/** Grid cell appointment shape returned from the MediCare API mappers. */
export interface ColumnAppointmentsType {
  id: string;
  docId: string;
  title: string;
  start: number;
  end: number;
  status: string;
}
