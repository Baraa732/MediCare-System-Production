import { Ban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAY_NAMES } from "./scheduleUtils";

type DoctorOption = { userId: string; label: string };

type ScheduleOpsFormsProps = {
  selectedDayOfWeek: number;
  selectedDateLabel: string;
  doctors: DoctorOption[];
  availForm: {
    doctorId: string;
    startTime: string;
    endTime: string;
  };
  blockForm: {
    doctorId: string;
    startTime: string;
    endTime: string;
    reason: string;
  };
  onAvailChange: (patch: Partial<ScheduleOpsFormsProps["availForm"]>) => void;
  onBlockChange: (patch: Partial<ScheduleOpsFormsProps["blockForm"]>) => void;
  onAddAvailability: () => void;
  onAddBlock: () => void;
};

export function ScheduleOpsForms({
  selectedDayOfWeek,
  selectedDateLabel,
  doctors,
  availForm,
  blockForm,
  onAvailChange,
  onBlockChange,
  onAddAvailability,
  onAddBlock,
}: ScheduleOpsFormsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section className="pbi-panel">
        <header className="pbi-panel-header">
          <div className="min-w-0">
            <h2 className="pbi-panel-title">Add doctor coverage</h2>
            <p className="pbi-panel-subtitle">
              Recurring every {DAY_NAMES[selectedDayOfWeek]}
            </p>
          </div>
          <Plus className="w-4 h-4 text-[#0066ff] shrink-0" />
        </header>
        <div className="pbi-panel-body space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="avail-doctor">Doctor</Label>
            <select
              id="avail-doctor"
              value={availForm.doctorId}
              onChange={(e) => onAvailChange({ doctorId: e.target.value })}
              className="h-9 w-full rounded-sm border border-input px-2.5 text-sm bg-white"
            >
              <option value="">Select doctor</option>
              {doctors.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="avail-start">Starts</Label>
              <Input
                id="avail-start"
                type="time"
                value={availForm.startTime}
                onChange={(e) => onAvailChange({ startTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avail-end">Ends</Label>
              <Input
                id="avail-end"
                type="time"
                value={availForm.endTime}
                onChange={(e) => onAvailChange({ endTime: e.target.value })}
              />
            </div>
          </div>
          <p className="text-[11px] text-[#929296] leading-relaxed">
            Keep slots inside clinic open hours so patients never see unavailable times.
          </p>
          <Button
            type="button"
            onClick={onAddAvailability}
            className="w-full bg-[#0066ff] hover:bg-[#0052cc] rounded-sm h-9 text-xs font-semibold"
          >
            Add recurring slot
          </Button>
        </div>
      </section>

      <section className="pbi-panel">
        <header className="pbi-panel-header">
          <div className="min-w-0">
            <h2 className="pbi-panel-title">Block time</h2>
            <p className="pbi-panel-subtitle">One-off closure on {selectedDateLabel}</p>
          </div>
          <Ban className="w-4 h-4 text-[#b45309] shrink-0" />
        </header>
        <div className="pbi-panel-body space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="block-doctor">Scope</Label>
            <select
              id="block-doctor"
              value={blockForm.doctorId}
              onChange={(e) => onBlockChange({ doctorId: e.target.value })}
              className="h-9 w-full rounded-sm border border-input px-2.5 text-sm bg-white"
            >
              <option value="">Whole clinic</option>
              {doctors.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.label} only
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="block-reason">Reason</Label>
            <Input
              id="block-reason"
              value={blockForm.reason}
              onChange={(e) => onBlockChange({ reason: e.target.value })}
              placeholder="Holiday, maintenance, training…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="block-start">From</Label>
              <Input
                id="block-start"
                type="time"
                value={blockForm.startTime}
                onChange={(e) => onBlockChange({ startTime: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-end">Until</Label>
              <Input
                id="block-end"
                type="time"
                value={blockForm.endTime}
                onChange={(e) => onBlockChange({ endTime: e.target.value })}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onAddBlock}
            className="w-full rounded-sm h-9 text-xs font-semibold border-[#e1dfdd]"
          >
            Create time block
          </Button>
        </div>
      </section>
    </div>
  );
}
