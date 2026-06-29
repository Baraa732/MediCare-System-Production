import * as React from "react";
import { cn } from "@/lib/utils";

interface CardWithoutBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardWithoutBackground = React.forwardRef<
  HTMLDivElement,
  CardWithoutBackgroundProps
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      /* FIXED: Removed the faulty arbitrary 'lg:max-w-287.5' and 'aspect-575/649'.
           We give single cards an elegant standard desktop boundary max-w-[500px].
        */
      className={cn(
        // "relative aspect-575/649  h-auto transition-all duration-300",
        "relative w-full max-w-md lg:max-w-143.75 aspect-auto lg:aspect-575/649 transition-all duration-300 ",

        className,
      )}
      {...props}
    >
      {/* Back Card Rotated Blue Canvas Accent Frame */}
      <div
        className="absolute inset-0 hidden sm:block rounded-[2.5rem] bg-[#0066ff] shadow-2xl transition-transform duration-500 ease-out select-none pointer-events-none transform rotate-[2.59deg]"
        aria-hidden="true"
      />

      {/* Front Container Card Base Frame */}
      <div className="relative w-full h-full bg-white rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden z-10">
        {children}
      </div>
    </div>
  );
});

CardWithoutBackground.displayName = "CardWithoutBackground";
