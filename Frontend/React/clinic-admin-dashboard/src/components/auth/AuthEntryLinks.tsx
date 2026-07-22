import { Link } from "react-router";
import { ArrowRight, KeyRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type AuthEntryLinksProps = {
  showRegisterPrompt?: boolean;
  showActivatePrompt?: boolean;
  registerHint?: string;
};

export function AuthEntryLinks({
  showRegisterPrompt = true,
  showActivatePrompt = true,
  registerHint,
}: AuthEntryLinksProps) {
  return (
    <div className="mt-5 pt-5 border-t border-neutral-100 grid gap-3 sm:grid-cols-2">
      {showRegisterPrompt && (
        <div className="rounded-xl border border-[#0066ff]/20 bg-[#ecf3ff]/50 p-3.5 space-y-2.5 h-full flex flex-col">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#0066ff] shadow-sm">
              <UserPlus className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#1A1B1E]">
                Clinic already activated?
              </p>
              <p className="text-xs text-[#929296] mt-0.5 leading-snug">
                {registerHint ??
                  "If you used your 6-digit code but haven’t finished your profile yet, pick up where you left off."}
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            className="mt-auto w-full h-10 rounded-xl border-[#0066ff] text-[#0066ff] hover:bg-[#ecf3ff] font-medium text-sm"
          >
            <Link to="/auth/register">
              Complete your admin account
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      )}

      {showActivatePrompt && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3.5 space-y-2.5 h-full flex flex-col text-center sm:text-left">
          <p className="text-sm font-medium text-[#1A1B1E]">New to MediCare?</p>
          <Button
            asChild
            className="w-full h-10 rounded-xl bg-[#0066ff] hover:bg-[#0052cc] text-white font-medium text-sm"
          >
            <Link to="/auth/activate-code">
              <KeyRound className="h-4 w-4 mr-2" />
              I have an activation code
            </Link>
          </Button>
          <p className="text-xs text-[#929296] leading-snug mt-auto">
            Activate your clinic with the 6-digit code from MediCare, then create
            your administrator account.
          </p>
        </div>
      )}
    </div>
  );
}
