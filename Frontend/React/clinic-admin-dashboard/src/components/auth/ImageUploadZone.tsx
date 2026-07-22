import { useEffect, useRef, useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 2 * 1024 * 1024;

type ImageUploadZoneProps = {
  label: string;
  helper: string;
  value: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  variant?: "square" | "circle";
};

export function ImageUploadZone({
  label,
  helper,
  value,
  onChange,
  disabled = false,
  variant = "square",
}: ImageUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const previewUrl = value ? URL.createObjectURL(value) : null;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickFile = (file: File | null) => {
    setLocalError(null);
    if (!file) {
      onChange(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setLocalError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("Image must be 2 MB or smaller.");
      return;
    }
    onChange(file);
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed p-4 transition-colors",
        dragOver
          ? "border-[#0066ff] bg-[#ecf3ff]/60"
          : "border-neutral-200 bg-[#fafcff]",
        disabled && "opacity-60 pointer-events-none",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled) pickFile(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-medium text-[#1A1B1E]">
            {label}
            <span className="text-[#0066ff] ml-0.5">*</span>
          </p>
          <p className="text-xs text-[#929296] mt-0.5">{helper}</p>
        </div>
        {value && (
          <button
            type="button"
            onClick={() => pickFile(null)}
            className="inline-flex items-center gap-1 text-xs text-[#929296] hover:text-[#1A1B1E]"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      {value && previewUrl ? (
        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "overflow-hidden border border-neutral-200 bg-white shadow-sm",
              variant === "circle"
                ? "h-28 w-28 rounded-full"
                : "h-32 w-full max-w-[220px] rounded-xl",
            )}
          >
            <img
              src={previewUrl}
              alt={label}
              className="h-full w-full object-cover"
            />
          </div>
          <p className="text-xs text-[#929296] truncate max-w-full">{value.name}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-neutral-100 bg-white px-4 py-8 text-center hover:border-[#0066ff]/30 hover:bg-[#ecf3ff]/30 transition-colors"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ecf3ff] text-[#0066ff]">
            {variant === "circle" ? (
              <Upload className="h-5 w-5" />
            ) : (
              <ImageIcon className="h-5 w-5" />
            )}
          </div>
          <span className="text-sm font-medium text-[#1A1B1E]">
            Click or drag to upload
          </span>
          <span className="text-xs text-[#929296]">JPEG, PNG, or WebP · max 2 MB</span>
        </button>
      )}

      {localError && (
        <p className="mt-2 text-xs text-red-500">{localError}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
