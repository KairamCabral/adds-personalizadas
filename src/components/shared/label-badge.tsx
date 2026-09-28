"use client";

import { useLabelTypeMap } from "@/hooks/use-label-types";
import { cn } from "@/lib/utils";

interface LabelBadgeProps {
  label: string;
  size?: "sm" | "md";
  onRemove?: () => void;
  className?: string;
}

export function LabelBadge({
  label,
  size = "sm",
  onRemove,
  className,
}: LabelBadgeProps) {
  const map = useLabelTypeMap();
  const config = map.get(label);
  if (!config) return null;

  return (
    <span
      style={{ backgroundColor: config.color, color: config.text_color }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        size === "sm" && "px-2.5 py-1 text-xs",
        size === "md" && "px-3 py-1.5 text-sm",
        className
      )}
    >
      {config.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-white/20"
        >
          <span className="sr-only">Remover</span>
          <svg
            className={size === "md" ? "h-3 w-3" : "h-2.5 w-2.5"}
            viewBox="0 0 10 10"
            fill="currentColor"
          >
            <path d="M3 3l4 4M7 3l-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
      )}
    </span>
  );
}
