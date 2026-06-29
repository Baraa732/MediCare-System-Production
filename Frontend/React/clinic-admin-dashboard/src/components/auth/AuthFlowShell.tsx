import { Plus } from "lucide-react";
import { Outlet, useLocation } from "react-router";
import { AuthStepProgress, type AuthFlowStep } from "./AuthStepProgress";

function resolveAuthStep(pathname: string): AuthFlowStep | null {
  if (pathname.includes("/auth/activate")) return "activate";
  if (pathname.includes("/auth/register")) return "register";
  if (pathname.includes("/auth/otp")) return "verify";
  return null;
}

export function AuthFlowShell() {
  const location = useLocation();
  const step = resolveAuthStep(location.pathname);
  const showProgress = step !== null;

  return (
    <main className="w-full min-h-screen bg-gradient-to-br from-[#ecf3ff] via-[#f5f8ff] to-[#e8f0fe] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg auth-card-enter">
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xl shadow-blue-900/5 overflow-hidden">
          <div className="flex items-center gap-3 px-7 pt-6 pb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ecf3ff] text-[#0066ff]">
              <Plus className="h-5 w-5" strokeWidth={3} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0066ff]">
                MediCare
              </p>
              <p className="text-sm font-medium text-[#1A1B1E]">Clinic Admin Portal</p>
            </div>
          </div>

          {showProgress && <AuthStepProgress current={step} />}

          <div key={location.pathname} className="auth-page-enter">
            <Outlet />
          </div>
        </div>

        <p className="text-center text-xs text-[#929296] mt-4">
          Secure healthcare operations platform
        </p>
      </div>
    </main>
  );
}
