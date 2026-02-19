import { LABEL_MAP, type LabelType } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface LabelBadgeProps {
  label: LabelType;
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
  const config = LABEL_MAP[label];
  if (!config) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        config.bgColor,
        config.textColor,
        size === "sm" && "px-2.5 py-1 text-xs",
        size === "md" && "px-3 py-1.5 text-sm",
        className
      )}
    >
      {config.label}
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
