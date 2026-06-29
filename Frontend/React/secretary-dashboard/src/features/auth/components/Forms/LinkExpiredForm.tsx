import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import type { LinkExpiredFormProps } from "../../types";
import { useAuthStore } from "@/stores/authStore";

// Functional Link Expired View Component


export function LinkExpiredForm({ isLoading = false }: LinkExpiredFormProps) {
  const navigate = useNavigate();
  const clearPasswordResetFlow = useAuthStore((s) => s.clearPasswordResetFlow);
  const onBackToLogin = () => {
    navigate("/auth/login", { replace: true });
  };
  const onRequestNewLink = () => {
    clearPasswordResetFlow();
    navigate("/auth/forget_password", { replace: true });
  };
  return (
    <>
      {/* Container tracking matching the signature 360px grid block boundaries */}
      <div className="flex-1 flex flex-col justify-center  p-7 w-full mx-auto">
        {/* Main Content Layout Block */}
        <div className="mb-10">
          <h1 className="font-inter text-[36px] font-semibold leading-[1.3] tracking-[-0.5px] text-[#1A1B1E]">
          Code expired
        </h1>

          <p className=" mt-4 font-inter text-[22px] font-normal leading-[1.6] tracking-normal text-[#929296]">
            This verification code has expired. Contact your clinic admin or{" "}
            <button
              onClick={onRequestNewLink}
              disabled={isLoading}
              className="font-inter text-[22px] font-normal leading-[1.6] tracking-normal text-[#0B74FA] underline cursor-pointer inline bg-transparent p-0 border-none outline-none disabled:opacity-50"
            >
              request a new code
            </button>
          </p>
        </div>

        {/* Action Trigger Navigation Stack */}
        <div className="space-y-4 w-full">
          <Button
            onClick={onBackToLogin}
            disabled={isLoading}
            className="w-full  h-13 bg-[#0066ff] hover:bg-[#0052cc] text-white font-inter text-[22px] font-semibold leading-[1.2] tracking-[0.02em] rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5 stroke-3" />
            Back to Login
          </Button>
        </div>
      </div>
    </>
  );
}
