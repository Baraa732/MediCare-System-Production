import { lazy, Suspense } from "react";
import { Plus } from "lucide-react";
import { Outlet, useLocation } from "react-router";
import { AuthStepProgress, type AuthFlowStep } from "./AuthStepProgress";

const AuthLottieHero = lazy(() =>
  import("./AuthLottieHero").then((m) => ({ default: m.AuthLottieHero })),
);

function resolveAuthStep(pathname: string): AuthFlowStep | null {
  if (pathname.includes("/auth/activate")) return "activate";
  if (pathname.includes("/auth/register")) return "register";
  if (pathname.includes("/auth/otp")) return "verify";
  return null;
}

const lottieSize =
  "h-72 w-72 xl:h-80 xl:w-80 2xl:h-[22rem] 2xl:w-[22rem]";

export function AuthFlowShell() {
  const location = useLocation();
  const step = resolveAuthStep(location.pathname);
  const showProgress = step !== null;

  return (
    <main className="fixed inset-0 overflow-hidden bg-gradient-to-br from-[#ecf3ff] via-[#f5f8ff] to-[#e8f0fe] flex items-center justify-center px-4 py-4 sm:px-6">
      <div className="w-full max-w-6xl auth-card-enter">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,48rem)] lg:gap-10 lg:items-center">
          <section className="hidden lg:flex flex-col items-start justify-center text-left">
            <Suspense
              fallback={
                <div
                  className={`${lottieSize} rounded-full bg-gradient-to-br from-[#ecf3ff] to-[#d6e6ff]`}
                  aria-hidden
                />
              }
            >
              <AuthLottieHero className={lottieSize} />
            </Suspense>
            <div className="mt-3 max-w-sm space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#0066ff]">
                MediCare Clinic Admin
              </p>
              <h2 className="text-lg font-semibold text-[#1A1B1E] xl:text-xl">
                Run your clinic with confidence
              </h2>
              <p className="text-sm text-[#929296] leading-snug">
                Staff, schedules, patients, and settings — all in one secure portal.
              </p>
            </div>
          </section>

          <div className="w-full mx-auto lg:max-w-none lg:mx-0">
            <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-[0_8px_30px_rgba(0,102,255,0.08)] ring-1 ring-black/[0.03] overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 sm:px-7 border-b border-neutral-100 bg-gradient-to-r from-white to-[#fafcff]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0066ff] text-white shadow-sm shadow-blue-200">
                  <Plus className="h-4 w-4" strokeWidth={3} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#0066ff]">
                    MediCare
                  </p>
                  <p className="text-sm font-semibold text-[#1A1B1E] leading-tight truncate">
                    Clinic Admin Portal
                  </p>
                </div>
              </div>

              {showProgress && <AuthStepProgress current={step} />}

              <div key={location.pathname} className="auth-page-enter px-6 py-4 sm:px-7 sm:py-5">
                <Outlet />
              </div>
            </div>

            <p className="text-center text-[11px] text-[#929296] mt-2">
              Secure healthcare operations platform
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
