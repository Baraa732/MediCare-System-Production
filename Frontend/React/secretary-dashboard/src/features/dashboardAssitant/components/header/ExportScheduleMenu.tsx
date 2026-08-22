import { useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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
        err instanceof Error ? err.message : "Export failed. Please try again.",
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
        sideOffset={10}
        className="w-[340px] overflow-hidden rounded-2xl border border-neutral-100 bg-white p-0 shadow-[0_18px_40px_-24px_rgba(0,102,255,0.35)]"
      >
        <div className="border-b border-neutral-100 bg-gradient-to-br from-blue-50/90 to-white px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0066ff]">
                Export schedule
              </p>
              <p className="mt-1 truncate text-sm font-bold text-neutral-900">
                {preview.meta.scheduleDateLabel}
              </p>
              <p
                className="mt-0.5 truncate text-[11px] font-medium text-neutral-500"
                dir="auto"
              >
                {preview.meta.clinicName}
              </p>
            </div>
            <div className="rounded-xl bg-white px-2.5 py-1.5 text-center shadow-sm ring-1 ring-blue-100">
              <div className="text-lg font-black leading-none tabular-nums text-[#0066ff]">
                {preview.meta.rowCount}
              </div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-400">
                rows
              </div>
            </div>
          </div>
          {(activeFilters > 0 || hasSearch) && (
            <span className="mt-3 inline-flex rounded-full bg-[#0066ff]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0066ff]">
              {activeFilters > 0
                ? `${activeFilters} filter${activeFilters === 1 ? "" : "s"}`
                : "Search"}{" "}
              applied
            </span>
          )}
        </div>

        <div className="space-y-1.5 p-2.5">
          <ExportOption
            disabled={busy !== null}
            loading={busy === "excel"}
            icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-50"
            title="Excel workbook"
            subtitle="Arabic + English · .xlsx day sheet"
            onClick={() => void runExport("excel")}
          />
          <ExportOption
            disabled={busy !== null}
            loading={busy === "pdf"}
            icon={<FileText className="h-4 w-4 text-[#0066ff]" />}
            iconBg="bg-blue-50"
            title="PDF day sheet"
            subtitle="Landscape A4 · bilingual clinic names"
            onClick={() => void runExport("pdf")}
          />
          <ExportOption
            disabled={busy !== null}
            loading={busy === "print"}
            icon={<Printer className="h-4 w-4 text-sky-600" />}
            iconBg="bg-sky-50"
            title="Print PDF"
            subtitle="Open the print dialog with the same layout"
            onClick={() => void runExport("print")}
          />
        </div>

        <div className="border-t border-neutral-100 bg-neutral-50/70 px-3.5 py-2.5">
          <p className="text-[10px] leading-relaxed text-neutral-500">
            Matches the current day and filters. Clinic and doctor names export
            in Arabic and English.
          </p>
          {error ? (
            <p className="mt-1.5 text-[11px] font-semibold text-red-600">{error}</p>
          ) : null}
          {lastOk ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
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
        "flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-all",
        "hover:border-blue-100 hover:bg-blue-50/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff]/40",
        "disabled:cursor-not-allowed disabled:opacity-60",
        loading && "border-blue-100 bg-blue-50/70",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
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
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
    </button>
  );
}
