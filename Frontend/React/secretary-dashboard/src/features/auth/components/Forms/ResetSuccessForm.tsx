import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/authStore";

export function ResetSuccessForm() {
  const navigate = useNavigate();
  const clearPasswordResetFlow = useAuthStore((s) => s.clearPasswordResetFlow);

  const onBackToLogin = () => {
    clearPasswordResetFlow();
    navigate("/auth/login", { replace: true });
  };

  return (
    <div className="flex-1 flex flex-col justify-center w-full mx-auto p-7">
      <div className="mb-10">
        <h1 className="font-inter text-[36px] font-semibold leading-[1.3] tracking-[-0.5px] text-[#1A1B1E]">
          You&apos;re good to go
        </h1>
        <p className="font-inter text-[22px] font-normal leading-[1.6] tracking-normal text-[#929296]">
          Your password has been reset. Go back to the login page and sign in with your new
          password.
        </p>
      </div>

      <div className="space-y-4">
        <Button
          type="button"
          onClick={onBackToLogin}
          className="w-full h-13 bg-[#0066ff] hover:bg-[#0052cc] text-white font-inter text-[22px] font-semibold leading-[1.2] tracking-[0.02em] rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4 stroke-3" />
          Back to login
        </Button>
      </div>
    </div>
  );
}
