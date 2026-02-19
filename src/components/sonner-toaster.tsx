"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/providers/theme-provider";

export function SonnerToaster() {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-card !border !border-border !text-foreground !shadow-lg",
          title: "!text-foreground !font-medium",
          description: "!text-foreground/90",
          error:
            "!bg-destructive/15 !border-destructive !text-foreground dark:!bg-destructive/25",
          success:
            "!bg-emerald-500/15 !border-emerald-500/50 !text-foreground dark:!bg-emerald-500/20",
          warning:
            "!bg-amber-500/15 !border-amber-500/50 !text-foreground dark:!bg-amber-500/20",
          info:
            "!bg-primary/15 !border-primary/50 !text-foreground dark:!bg-primary/20",
        },
      }}
      closeButton
    />
  );
}
