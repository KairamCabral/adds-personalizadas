"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardProgressProps {
  steps: string[];
  currentIndex: number;
}

export function WizardProgress({ steps, currentIndex }: WizardProgressProps) {
  return (
    <div className="w-full max-w-full min-w-0 overflow-x-auto overflow-y-visible pb-1 pt-6 -mx-1 px-1">
      <div className="flex items-start justify-center gap-0 min-w-max mx-auto">
        {steps.map((label, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;

          return (
            <div key={label} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                <div
                  className={cn(
                    "h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all duration-300 shrink-0",
                    isCompleted && "bg-primary text-primary-foreground shadow-md",
                    isCurrent &&
                      "bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.25)] scale-110",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : index + 1}
                </div>
                <span
                  className={cn(
                    "text-[10px] sm:text-xs font-medium text-center max-w-[4rem] sm:max-w-none sm:whitespace-nowrap transition-colors leading-tight",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 sm:h-1 w-6 sm:w-12 md:w-24 mx-0.5 sm:mx-1 md:mx-2 mt-[-18px] sm:mt-[-20px] rounded-full transition-colors duration-300 flex-shrink-0",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
