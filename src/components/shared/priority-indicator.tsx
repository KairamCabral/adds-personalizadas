import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriorityIndicatorProps {
  priority: "NORMAL" | "ALTA";
  showLabel?: boolean;
  className?: string;
}

export function PriorityIndicator({
  priority,
  showLabel = false,
  className,
}: PriorityIndicatorProps) {
  if (priority === "NORMAL") {
    if (!showLabel) return null;
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        Normal
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-sm font-semibold text-red-500",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4" />
      {showLabel && "Alta"}
    </span>
  );
}
