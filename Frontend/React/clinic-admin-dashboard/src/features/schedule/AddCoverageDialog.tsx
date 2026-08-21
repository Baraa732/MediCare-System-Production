import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAY_NAMES } from "./scheduleUtils";

type DoctorOption = { userId: string; label: string };

type AddCoverageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: DoctorOption[];
  defaultDayOfWeek: number;
  defaultStart?: string;
  defaultEnd?: string;
  onSubmit: (values: {
    doctorId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) => Promise<void> | void;
};

export function AddCoverageDialog({
  open,
  onOpenChange,
  doctors,
  defaultDayOfWeek,
  defaultStart = "09:00",
  defaultEnd = "12:00",
  onSubmit,
}: AddCoverageDialogProps) {
  const [doctorId, setDoctorId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(defaultDayOfWeek);
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [busy, setBusy] = useState(false);

  const syncDefaults = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (nextOpen) {
      setDoctorId(doctors[0]?.userId ?? "");
      setDayOfWeek(defaultDayOfWeek);
      setStartTime(defaultStart);
      setEndTime(defaultEnd);
    }
  };

  const submit = async () => {
    if (!doctorId) return;
    setBusy(true);
    try {
      await onSubmit({ doctorId, dayOfWeek, startTime, endTime });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={syncDefaults}>
      <DialogContent className="sm:max-w-md rounded-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>Add doctor coverage</DialogTitle>
          <DialogDescription>
            Creates a recurring weekday slot secretaries can book against.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="cov-doctor">Doctor</Label>
            <select
              id="cov-doctor"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
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
          <div className="space-y-1.5">
            <Label htmlFor="cov-day">Weekday</Label>
            <select
              id="cov-day"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="h-9 w-full rounded-sm border border-input px-2.5 text-sm bg-white"
            >
              {DAY_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  Every {name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cov-start">Starts</Label>
              <Input
                id="cov-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cov-end">Ends</Label>
              <Input
                id="cov-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="rounded-b-sm">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!doctorId || busy}
            onClick={() => void submit()}
            className="bg-[#0066ff] hover:bg-[#0052cc]"
          >
            {busy ? "Saving…" : "Add coverage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
