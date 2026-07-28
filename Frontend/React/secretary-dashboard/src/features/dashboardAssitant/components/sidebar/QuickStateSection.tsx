import  { cn } from "@/lib/utils";
import { QuickState } from "../../data/sideBarData";

export function QuickStateSection() {
  const quickState = QuickState();
  return (
    <div className="p-5 border-b border-[#DBDBDC]">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-3.5">
        Quick Stats:
      </h4>
      <div className="space-y-3">
        {quickState.map((stat, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between text-xs font-semibold"
          >
            <div className="flex items-center gap-2 text-neutral-500">
              <div
                className={cn(
                  "w-5 h-5 rounded-md flex items-center justify-center",
                  stat.bg,
                  stat.color,
                )}
              >
                <stat.icon className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span
                className={cn(
                  " font-bold px-2 py-0.5 rounded-full",
                  stat.color,
                )}
              >
                {stat.count}
              </span>
              <span>{stat.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}