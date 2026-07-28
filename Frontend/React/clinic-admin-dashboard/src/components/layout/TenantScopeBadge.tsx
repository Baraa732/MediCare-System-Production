import { Building2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type TenantScopeBadgeProps = {
  clinicName?: string | null;
  className?: string;
};

/** Shows that data is scoped to the signed-in clinic tenant. */
export function TenantScopeBadge({ clinicName, className }: TenantScopeBadgeProps) {
  const label = clinicName?.trim() || "Your clinic";

  return (
    <div
      className={cn(
        "hidden md:inline-flex items-center gap-1.5 rounded-sm border border-[#c7dcff] bg-[#ecf3ff]/70 px-2.5 py-1 text-[11px] font-medium text-[#0052cc]",
        className,
      )}
      title={`All data is limited to ${label}`}
    >
      <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />
      <Building2 className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
      <span className="truncate max-w-[180px]">{label}</span>
      <span className="text-[#0066ff]/70 hidden lg:inline">· tenant scoped</span>
    </div>
  );
}
