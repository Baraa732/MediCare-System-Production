import { Check, Building2, UserCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type AuthFlowStep = "activate" | "register" | "verify";

const STEPS: { id: AuthFlowStep; label: string; icon: typeof Building2 }[] = [
  { id: "activate", label: "Activate", icon: Building2 },
  { id: "register", label: "Profile", icon: UserCircle },
  { id: "verify", label: "Verify", icon: ShieldCheck },
];

export function AuthStepProgress({ current }: { current: AuthFlowStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="px-5 pt-4 pb-1 sm:px-6">
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const done = index < currentIndex;
          const active = index === currentIndex;

          return (
            <div key={step.id} className="flex flex-1 items-center gap-2 min-w-0">
              <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500",
                    done && "border-[#0066ff] bg-[#0066ff] text-white scale-100",
                    active &&
                      "border-[#0066ff] bg-[#ecf3ff] text-[#0066ff] scale-110 shadow-md shadow-blue-100",
                    !done &&
                      !active &&
                      "border-neutral-200 bg-white text-neutral-400",
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide truncate w-full text-center transition-colors",
                    active ? "text-[#0066ff]" : done ? "text-neutral-700" : "text-neutral-400",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full mb-5 transition-all duration-700",
                    index < currentIndex ? "bg-[#0066ff]" : "bg-neutral-200",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RegisterSubSteps({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-all duration-500",
            i < current
              ? "bg-[#0066ff]"
              : i === current
                ? "auth-shimmer-bar"
                : "bg-neutral-200",
          )}
        />
      ))}
    </div>
  );
}
