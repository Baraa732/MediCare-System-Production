import * as React from "react";
import { cn } from "@/lib/utils";

interface AuthCardWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardWithBackground = React.forwardRef<HTMLDivElement, AuthCardWrapperProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative w-full max-w-md lg:max-w-287.5 aspect-auto lg:aspect-1150/649 transition-all duration-300 ",
          className
        )}
        {...props}
      >
      
        <div
          className="absolute inset-0 hidden lg:block rounded-[2.5rem] bg-[#0066ff] shadow-2xl transition-transform duration-500 ease-out select-none pointer-events-none transform rotate-[2.59deg]"
          aria-hidden="true"
        />

        <div className="relative w-full h-full bg-white rounded-3xl lg:rounded-[2.5rem] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          {children}
        </div>
      </div>
    );
  }
);

CardWithBackground.displayName = "AuthCardWrapper";