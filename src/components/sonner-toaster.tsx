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
      /* Evita stack colapsado com altura fixa — texto de título/descrição não se sobrepõe */
      expand
      gap={16}
      toastOptions={{
        classNames: {
          toast:
            "!items-start !bg-card !border !border-border !text-foreground !shadow-lg",
          title: "!text-foreground !font-medium !leading-snug",
          description:
            "!mt-0.5 !block !text-foreground/90 !text-sm !leading-relaxed",
          content: "!min-w-0 !flex-1",
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
      containerAriaLabel="Notificações"
    />
  );
}
