import * as React from "react";
import { ArrowLeft } from "lucide-react";

// Shadcn UI Button dependency
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import type { CheckEmailFormProps } from "../../types";



export function CheckEmailForm({
  emailAddress = "Example@gmail.com",
}: CheckEmailFormProps) {
  const [countdown, setCountdown] = React.useState<number>(10);
  const navigate = useNavigate();
  React.useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 60000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResend = (e: React.MouseEvent) => {
    e.preventDefault();
    if (countdown === 0) {
      setCountdown(10);
      // Trigger your programmatic API hook for code resends here
    }
  };
  const onChangeEmail = () => {
    history.back();
  };
  const onBackToLogin = () => {
    navigate("/auth/login", { replace: true });
  };
  return (
    <div className="flex-1 flex flex-col justify-center p-7 w-full mx-auto">
      {/* Main Header Typography Block */}
      <div>
        <h1 className="font-inter text-[36px] font-semibold leading-[1.3] tracking-[-0.5px] text-[#1A1B1E]">
          Check you Email
        </h1>

        {/* Email Context Subtext */}
        <p className="font-inter text-[22px] font-normal leading-[1.6] tracking-normal text-[#929296]">
          We send a reset link to{" "}
          <span className="font-inter text-[22px] font-normal leading-[1.6] tracking-normal text-[#0B74FA] break-all">
            {emailAddress}
          </span>
          , you will receive it shortly
        </p>

        {/* Spam Warning Descriptive Copy Block */}
        <p className=" mt-4 font-inter text-[22px] font-normal leading-[1.6] tracking-normal text-[#929296]">
          The link will be valid for 1 hour, if you didn't receive an email,
          please check your spamfolder
        </p>
      </div>

      {/* Dynamic Action Trigger Utilities */}
      <div className="mt-6 mb-8">
        {countdown > 0 ? (
          <span className="font-inter text-[18px] font-normal leading-normal tracking-[0.02em] underline underline-offset-0 decoration-0 text-[#0B74FA]">
            Resend code in {countdown} minute
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="text-[18px] font-inter font-normal tracking-[2%] leading-normal text-[rgba(11_116_250/1)] underline cursor-pointer"
          >
            Resend verification code
          </button>
        )}
      </div>

      {/* Command Navigation Action Trigger Stack */}
      <div className="space-y-4">
        {/* Main Return Action CTA Option */}
        <Button
          type="button"
          onClick={onBackToLogin}
          className="w-full h-13 bg-[#0066ff] hover:bg-[#0052cc] text-white font-inter text-lg font-semibold leading-[1.2] tracking-[0.02em] rounded-xl transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5 stroke-3" />
          Back to Login
        </Button>

        {/* Alternative State Link Trigger Modifier */}
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onChangeEmail}
            className="inline-block font-inter text-[18px] font-normal leading-normal tracking-[0.02em] text-center underline text-[#0B74FA] decoration-0 hover:underline underline-offset-4 cursor-pointer focus:outline-none px-2 py-0.5"
          >
            Change Email
          </button>
        </div>
      </div>
    </div>
  );
}
