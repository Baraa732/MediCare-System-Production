import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { uploadClinicLogo } from "@/lib/api/clinics";
import { normalizeCaughtError } from "@/lib/api/errors";
import { resolveAssetUrl } from "@/lib/resolveAssetUrl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 2 * 1024 * 1024;

type ClinicLogoUploadProps = {
  clinicId: string;
  token: string;
  logoUrl?: string | null;
  onUploaded: (logoUrl: string) => void;
};

export function ClinicLogoUpload({
  clinicId,
  token,
  logoUrl,
  onUploaded,
}: ClinicLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayUrl = resolveAssetUrl(logoUrl);

  const handleFile = async (file: File | null) => {
    setError(null);
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 2 MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const res = await uploadClinicLogo(clinicId, file, token);
      if (res.clinic.logoUrl) onUploaded(res.clinic.logoUrl);
    } catch (err) {
      setError(normalizeCaughtError(err, "Logo upload failed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div
          className={cn(
            "w-24 h-24 rounded-sm border border-[#edebe9] bg-[#faf9f8] flex items-center justify-center overflow-hidden shrink-0",
            displayUrl && "border-[#c7dcff]",
          )}
        >
          {displayUrl ? (
            <img src={displayUrl} alt="Clinic logo" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-8 h-8 text-[#929296]" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-[#1a1b1e]">Clinic logo</p>
          <p className="text-xs text-[#929296]">
            Shown in patient-facing listings and your admin workspace. JPEG, PNG, or WebP · max 2
            MB.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-sm h-8 text-xs"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 mr-1.5" />
            )}
            {uploading ? "Uploading…" : displayUrl ? "Replace logo" : "Upload logo"}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        disabled={uploading}
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
