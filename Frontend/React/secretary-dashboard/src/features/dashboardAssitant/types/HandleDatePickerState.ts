export interface HandleDatePickerState {
  date: Date;
  handlePreviousDay: () => void;
  handleGoToToday: () => void;
  handleNextDay: () => void;
  handleChangeDate: (newDate: Date) => void;
}