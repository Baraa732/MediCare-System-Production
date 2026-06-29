import { Building2, Clock, Copy, MapPin, Phone } from "lucide-react";
import type { ClinicDoctor, ClinicPublic } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ClinicHoursDay = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed?: boolean;
};

type ClinicPreviewCardProps = {
  clinic: Partial<ClinicPublic>;
  doctors: ClinicDoctor[];
  hours?: ClinicHoursDay[];
  dirty?: boolean;
};

export function ClinicPreviewCard({
  clinic,
  doctors,
  hours = [],
  dirty,
}: ClinicPreviewCardProps) {
  const copyId = () => {
    if (clinic.id) void navigator.clipboard.writeText(clinic.id);
  };

  const todayHours = hours.find((h) => h.dayOfWeek === new Date().getDay());
  const openDays = hours.filter((h) => !h.isClosed).length;

  return (
    <div className="pbi-panel overflow-hidden">
      <div className="bg-[#0066ff] px-5 py-5 text-white relative overflow-hidden">
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
        <div className="relative flex items-start gap-3">
          <div className="w-11 h-11 rounded-sm bg-white/15 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              Live preview
            </p>
            <h3 className="text-lg font-bold truncate mt-0.5">
              {clinic.name?.trim() || "Clinic name"}
            </h3>
            {clinic.status && (
              <span className="inline-flex mt-2 text-[10px] font-bold uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded-sm">
                {clinic.status}
              </span>
            )}
          </div>
        </div>
        {dirty && (
          <p className="relative mt-3 text-[11px] bg-white/15 rounded-sm px-2 py-1 inline-block">
            Unsaved changes
          </p>
        )}
      </div>

      <div className="p-4 space-y-4 text-sm">
        {(clinic.address || clinic.city) && (
          <p className="flex items-start gap-2 text-[#1a1b1e]">
            <MapPin className="w-4 h-4 text-[#929296] shrink-0 mt-0.5" />
            <span>
              {[clinic.address, clinic.city, clinic.governorate].filter(Boolean).join(", ") ||
                "—"}
            </span>
          </p>
        )}

        {clinic.phone && (
          <p className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#929296]" />
            <span className="font-medium">{clinic.phone}</span>
          </p>
        )}

        {clinic.email && (
          <p className="text-[#929296] truncate">{clinic.email}</p>
        )}

        {clinic.description && (
          <p className="text-xs text-[#929296] leading-relaxed border-t border-[#edebe9] pt-3">
            {clinic.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3">
            <p className="text-[10px] font-bold uppercase text-[#929296]">Doctors</p>
            <p className="text-xl font-semibold tabular-nums mt-0.5">{doctors.length}</p>
          </div>
          <div className="rounded-sm border border-[#edebe9] bg-[#faf9f8] p-3">
            <p className="text-[10px] font-bold uppercase text-[#929296] flex items-center gap-1">
              <Clock className="w-3 h-3" /> Open days
            </p>
            <p className="text-xl font-semibold tabular-nums mt-0.5">{openDays}/7</p>
          </div>
        </div>

        {todayHours && (
          <div className="rounded-sm border border-[#ecf3ff] bg-[#ecf3ff]/40 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-[#0066ff]">Today</p>
            <p className="text-sm font-semibold mt-0.5">
              {todayHours.isClosed
                ? "Closed"
                : `${todayHours.openTime} – ${todayHours.closeTime}`}
            </p>
          </div>
        )}

        {hours.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase text-[#929296] mb-2">Weekly hours</p>
            <ul className="space-y-1">
              {hours.map((h) => (
                <li
                  key={h.dayOfWeek}
                  className={cn(
                    "flex justify-between text-xs py-1 border-b border-[#f3f2f1] last:border-0",
                    h.dayOfWeek === new Date().getDay() && "text-[#0066ff] font-semibold",
                  )}
                >
                  <span>{DAY_NAMES[h.dayOfWeek]}</span>
                  <span className="tabular-nums">
                    {h.isClosed ? "Closed" : `${h.openTime}–${h.closeTime}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {clinic.id && (
          <div className="pt-2 border-t border-[#edebe9]">
            <p className="text-[10px] font-bold uppercase text-[#929296] mb-1">Clinic ID</p>
            <div className="flex items-center gap-2">
              <code className="text-[10px] font-mono text-[#1a1b1e] truncate flex-1">
                {clinic.id}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyId}
                className="h-7 rounded-sm text-[10px] shrink-0"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
          </div>
        )}

        {clinic.timezone && (
          <p className="text-xs text-[#929296]">Timezone: {clinic.timezone}</p>
        )}
      </div>
    </div>
  );
}
