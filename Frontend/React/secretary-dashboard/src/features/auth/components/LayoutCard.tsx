import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";

export default function LayoutCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between w-full h-full p-6 bg-white rounded-4xl z-10 transition-all duration-300",
        className,
      )}
    >
      <div className="flex items-center gap-3 mb-6 lg:mb-0 select-none">
        <div className="flex items-center justify-center w-6.25 h-6.25 rounded-lg text-[#0B74FA]">
          <PlusIcon className="w-6.25 h-6.25 stroke-[7px]" />
        </div>
        <span className="font-inter font-semibold tracking-[2%] text-lg  leading-[1.2] text-[#1A1B1E]">
          Project name
        </span>
      </div>

      {children}

      <div className="hidden lg:block h-2" />
    </div>
  );
}
