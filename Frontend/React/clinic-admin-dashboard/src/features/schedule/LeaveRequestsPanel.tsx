import { format, parseISO } from "date-fns";
import { Check, Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScheduleBlock } from "@/lib/api/schedule";

type LeaveRequestsPanelProps = {
  blocks: ScheduleBlock[];
  doctorName: (id: string) => string;
  reviewingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
};

function statusClass(status: string) {
  if (status === "PENDING") return "bg-amber-50 text-amber-700";
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-700";
  if (status === "REJECTED") return "bg-red-50 text-red-700";
  return "bg-neutral-100 text-neutral-600";
}

function formatRange(startsAt: string, endsAt: string) {
  const start = parseISO(startsAt);
  const end = parseISO(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  const sameDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");
  if (sameDay) {
    return `${format(start, "EEE d MMM")} · ${format(start, "HH:mm")}–${format(end, "HH:mm")}`;
  }
  return `${format(start, "d MMM HH:mm")} → ${format(end, "d MMM HH:mm")}`;
}

export function LeaveRequestsPanel({
  blocks,
  doctorName,
  reviewingId,
  onApprove,
  onReject,
}: LeaveRequestsPanelProps) {
  const doctorLeaves = [...blocks]
    .filter((b) => Boolean(b.doctorId))
    .sort((a, b) => {
      const rank = (s?: string) => (s === "PENDING" ? 0 : s === "APPROVED" ? 1 : 2);
      return rank(a.status) - rank(b.status) || +new Date(b.startsAt) - +new Date(a.startsAt);
    });

  const pendingCount = doctorLeaves.filter((b) => b.status === "PENDING").length;

  return (
    <section className="pbi-panel">
      <header className="pbi-panel-header">
        <div className="min-w-0">
          <h2 className="pbi-panel-title">Doctor leave requests</h2>
          <p className="pbi-panel-subtitle">
            Approve to block the doctor’s calendar and stop new bookings. Reject to keep them available.
          </p>
        </div>
        {pendingCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            <Clock3 className="h-3 w-3" />
            {pendingCount} pending
          </span>
        ) : null}
      </header>
      <div className="overflow-x-auto">
        <table className="pbi-data-table min-w-[640px]">
          <thead>
            <tr>
              <th>Doctor</th>
              <th>When</th>
              <th>Reason</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {doctorLeaves.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[#929296]">
                  No doctor leave requests yet.
                </td>
              </tr>
            ) : (
              doctorLeaves.map((block) => {
                const status = block.status ?? "APPROVED";
                const pending = status === "PENDING";
                return (
                  <tr key={block.id}>
                    <td className="font-medium">
                      {doctorName(block.doctorId as string)}
                    </td>
                    <td className="tabular-nums text-sm">
                      {formatRange(block.startsAt, block.endsAt)}
                    </td>
                    <td className="max-w-[240px] truncate text-sm text-[#5c5c60]">
                      {block.reason?.trim() || "Leave"}
                    </td>
                    <td>
                      <span className={`pbi-status-pill ${statusClass(status)}`}>
                        {status.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      {pending ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-sm text-xs"
                            disabled={reviewingId === block.id}
                            onClick={() => onReject(block.id)}
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            Reject
                          </Button>
                          <Button
                            type="button"
                            className="h-8 rounded-sm bg-[#0066ff] text-xs hover:bg-[#0052cc]"
                            disabled={reviewingId === block.id}
                            onClick={() => onApprove(block.id)}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />
                            {reviewingId === block.id ? "Saving…" : "Approve"}
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
