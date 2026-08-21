import { useState } from "react";
import { format } from "date-fns";
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

type DoctorOption = { userId: string; label: string };

type BlockTimeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: DoctorOption[];
  date: Date;
  defaultStart?: string;
  defaultEnd?: string;
  onSubmit: (values: {
    doctorId: string;
    startTime: string;
    endTime: string;
    reason: string;
  }) => Promise<void> | void;
};

export function BlockTimeDialog({
  open,
  onOpenChange,
  doctors,
  date,
  defaultStart = "09:00",
  defaultEnd = "17:00",
  onSubmit,
}: BlockTimeDialogProps) {
  const [doctorId, setDoctorId] = useState("");
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const syncDefaults = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (nextOpen) {
      setDoctorId("");
      setStartTime(defaultStart);
      setEndTime(defaultEnd);
      setReason("");
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({ doctorId, startTime, endTime, reason });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={syncDefaults}>
      <DialogContent className="sm:max-w-md rounded-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle>Block time</DialogTitle>
          <DialogDescription>
            One-off closure on {format(date, "EEEE, MMM d, yyyy")}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="blk-scope">Scope</Label>
            <select
              id="blk-scope"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
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
            <Label htmlFor="blk-reason">Reason</Label>
            <Input
              id="blk-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Holiday, maintenance, training…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="blk-start">From</Label>
              <Input
                id="blk-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blk-end">Until</Label>
              <Input
                id="blk-end"
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
            disabled={busy}
            onClick={() => void submit()}
            className="bg-[#0066ff] hover:bg-[#0052cc]"
          >
            {busy ? "Saving…" : "Create block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
