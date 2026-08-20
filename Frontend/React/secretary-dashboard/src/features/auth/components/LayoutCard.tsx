import { cn } from "@/lib/utils";
import { Stethoscope } from "lucide-react";

export default function LayoutCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "z-10 flex h-full w-full flex-col justify-between rounded-4xl bg-white p-6 sm:p-8",
        className,
      )}
    >
      <div className="mb-6 flex select-none items-center gap-3 lg:mb-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-sm">
          <Stethoscope className="h-4.5 w-4.5" />
        </div>
        <div>
          <span className="block text-lg font-bold leading-tight tracking-tight text-neutral-900">
            MediCare
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Secretary portal
          </span>
        </div>
      </div>

      {children}

      <div className="hidden h-2 lg:block" />
    </div>
  );
}
