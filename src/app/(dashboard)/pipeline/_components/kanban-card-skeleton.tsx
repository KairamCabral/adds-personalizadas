"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function KanbanCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-sm",
        className
      )}
    >
      <div className="mb-2 flex gap-1">
        <Skeleton className="h-5 w-14 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
      <Skeleton className="mb-2 h-4 w-full rounded" />
      <Skeleton className="mb-1 h-3 w-[80%] rounded" />
      <Skeleton className="h-3 w-[60%] rounded" />
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-3 w-16 rounded" />
        </div>
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
    </div>
  );
}
