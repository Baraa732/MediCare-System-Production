import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageLoading({ label = "Loading workspace data…" }: { label?: string }) {
  return (
    <div className="pbi-state">
      <div className="pbi-spinner" />
      <p className="text-sm font-medium text-neutral-600">{label}</p>
    </div>
  );
}

export function PageError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="pbi-state pbi-state-error">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-3 rounded-lg">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

export function AlertBanner({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "info" | "error";
}) {
  return (
    <p
      className={
        tone === "error"
          ? "text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5"
          : "text-sm text-[#0066ff] bg-[#ecf3ff] border border-[#c7dcff] rounded-lg px-4 py-2.5"
      }
    >
      {message}
    </p>
  );
}
