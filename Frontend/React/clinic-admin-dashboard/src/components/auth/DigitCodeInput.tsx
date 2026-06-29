import { cn } from "@/lib/utils";
import { useRef, type KeyboardEvent, type ClipboardEvent } from "react";

interface DigitCodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  inputMode?: "numeric" | "text";
}

export function DigitCodeInput({
  length = 6,
  value,
  onChange,
  disabled,
  invalid,
  inputMode = "numeric",
}: DigitCodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, " ").slice(0, length).split("");

  const updateAt = (index: number, char: string) => {
    const next = digits.map((d, i) => (i === index ? char : d.trim())).join("");
    onChange(next.slice(0, length));
    if (char && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]?.trim()) {
        updateAt(index, "");
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        updateAt(index - 1, "");
      }
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < length - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\s/g, "")
      .slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    refs.current[focusIndex]?.focus();
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode={inputMode}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={digits[index]?.trim() ?? ""}
          aria-invalid={invalid}
          onPaste={handlePaste}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "").slice(-1);
            updateAt(index, raw);
          }}
          className={cn(
            "w-11 h-12 sm:w-12 sm:h-13 text-center text-lg font-semibold rounded-xl border bg-white outline-none transition-all",
            invalid
              ? "border-red-500 focus:ring-4 focus:ring-red-100"
              : "border-neutral-200 focus:border-[#0066ff] focus:ring-4 focus:ring-blue-100",
            disabled && "opacity-60 cursor-not-allowed",
          )}
        />
      ))}
    </div>
  );
}
