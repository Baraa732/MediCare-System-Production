import { useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useScheduleContext } from "../../context/ScheduleContext";
import { useScheduleGridStore } from "../../hooks/scheduleGridStore";
import { buildScheduleExportDataset } from "@/lib/export/buildScheduleExportRows";
import { countActiveScheduleFilters } from "../../utils/scheduleFilters";

type ExportAction = "excel" | "pdf" | "print" | null;

interface ExportScheduleMenuProps {
  exportedBy?: string;
}

export function ExportScheduleMenu({ exportedBy }: ExportScheduleMenuProps) {
  const { doctors, selectedDate, clinicName } = useScheduleContext();
  const filters = useScheduleGridStore((s) => s.filters);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<string | null>(null);

  const preview = useMemo(
    () =>
      buildScheduleExportDataset({
        doctors,
        filters,
        selectedDate,
        clinicName,
        exportedBy,
      }),
    [doctors, filters, selectedDate, clinicName, exportedBy],
  );

  const activeFilters = countActiveScheduleFilters(filters);
  const hasSearch = filters.query.trim().length > 0;

  const runExport = async (action: Exclude<ExportAction, null>) => {
    setBusy(action);
    setError(null);
    setLastOk(null);
    try {
      const dataset = buildScheduleExportDataset({
        doctors,
        filters,
        selectedDate,
        clinicName,
        exportedBy,
      });

      if (action === "excel") {
        const { exportScheduleExcel } = await import("@/lib/export/exportExcel");
        await exportScheduleExcel(dataset);
        setLastOk("Excel workbook downloaded");
      } else if (action === "pdf") {
        const { exportSchedulePdf } = await import("@/lib/export/exportPdf");
        await exportSchedulePdf({ ...dataset, mode: "download" });
        setLastOk("PDF downloaded");
      } else {
        const { exportSchedulePdf } = await import("@/lib/export/exportPdf");
        await exportSchedulePdf({ ...dataset, mode: "print" });
        setLastOk("Print dialog opened");
      }
    } catch (err) {
      console.error("[export]", err);
      setError(
        err instanceof Error
          ? err.message
          : "Export failed. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          className="btn-brand h-9.5 rounded-xl px-4 text-xs font-bold shadow-sm cursor-pointer gap-2"
          disabled={busy !== null}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span>Export</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[340px] overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-0 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.45)]"
      >
        {/* Header */}
        <div className="relative overflow-hidden border-b border-neutral-100 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-3.5 text-white">
          <div
            className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[#0066ff]/30 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-200/90">
                <Sparkles className="h-3 w-3" />
                Schedule export
              </div>
              <p className="mt-1 text-sm font-bold leading-snug">
                {preview.meta.scheduleDateLabel}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {preview.meta.clinicName}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 px-2.5 py-1.5 text-center backdrop-blur-sm">
              <div className="text-lg font-black leading-none tabular-nums">
                {preview.meta.rowCount}
              </div>
              <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-300">
                rows
              </div>
            </div>
          </div>

          <div className="relative mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
              <ShieldCheck className="h-3 w-3" />
              IDs & phones excluded
            </span>
            {(activeFilters > 0 || hasSearch) && (
              <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200 ring-1 ring-white/15">
                {activeFilters > 0
                  ? `${activeFilters} filter${activeFilters === 1 ? "" : "s"}`
                  : "Search"}{" "}
                applied
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-1.5 p-2.5">
          <ExportOption
            disabled={busy !== null}
            loading={busy === "excel"}
            icon={
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            }
            iconBg="bg-emerald-50"
            title="Excel workbook"
            subtitle=".xlsx · styled columns, frozen header, zebra rows"
            onClick={() => void runExport("excel")}
          />
          <ExportOption
            disabled={busy !== null}
            loading={busy === "pdf"}
            icon={<FileText className="h-4 w-4 text-rose-600" />}
            iconBg="bg-rose-50"
            title="PDF day sheet"
            subtitle="Landscape A4 · branded header, status colors, page numbers"
            onClick={() => void runExport("pdf")}
          />
          <ExportOption
            disabled={busy !== null}
            loading={busy === "print"}
            icon={<Printer className="h-4 w-4 text-sky-600" />}
            iconBg="bg-sky-50"
            title="Print PDF"
            subtitle="Opens the system print dialog from the same layout"
            onClick={() => void runExport("print")}
          />
        </div>

        <DropdownMenuSeparator className="my-0" />

        <div className="space-y-1.5 bg-neutral-50/80 px-3.5 py-2.5">
          <p className="text-[10px] leading-relaxed text-neutral-500">
            Exports match your current day and filters. Sensitive fields
            (patient ID, doctor ID, appointment ID, phone) are never included.
          </p>
          {error ? (
            <p className="text-[11px] font-semibold text-red-600">{error}</p>
          ) : null}
          {lastOk ? (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {lastOk}
            </p>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ExportOption({
  icon,
  iconBg,
  title,
  subtitle,
  onClick,
  disabled,
  loading,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-all",
        "hover:border-neutral-200 hover:bg-neutral-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff]/40",
        "disabled:cursor-not-allowed disabled:opacity-60",
        loading && "border-blue-100 bg-blue-50/60",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          iconBg,
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
        ) : (
          icon
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-neutral-900">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-snug text-neutral-500">
          {subtitle}
        </span>
      </span>
    </button>
  );
}
