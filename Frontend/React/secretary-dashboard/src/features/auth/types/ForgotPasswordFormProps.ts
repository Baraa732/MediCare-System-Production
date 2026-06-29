export interface ForgotPasswordFormProps {
  onSendResetCode: (phoneNumber: string) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}
