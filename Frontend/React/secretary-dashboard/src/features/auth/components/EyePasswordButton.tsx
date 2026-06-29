
import { EyeOff, Eye } from "lucide-react";
import { switchActiveRightClick } from "../data/switchActiveRightClick";

export default function EyePasswordButton({
  setShowPassword,
  showPassword,
}: {
  setShowPassword: (v: boolean) => void;
  showPassword: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      // className="absolute end-3.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
      className="absolute inset-e-3.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
    >
      {showPassword ? (
        <EyeOff className="w-4 h-4" {...switchActiveRightClick(showPassword)}  />
      ) : (
        <Eye className="w-4 h-4" {...switchActiveRightClick(showPassword)} />
      )}
    </button>
  );
}
