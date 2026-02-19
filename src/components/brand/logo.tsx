"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_PATH = "/Logo-cor-PNG.png";

const SIZES = {
  sm: { width: 32, height: 32 },
  md: { width: 48, height: 48 },
  lg: { width: 64, height: 64 },
} as const;

interface LogoProps {
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
}

export function Logo({ size = "md", className, priority = false }: LogoProps) {
  const { width, height } = SIZES[size];
  return (
    <Image
      src={LOGO_PATH}
      alt="ADDS Brasil"
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      priority={priority}
      className={cn("object-contain", className)}
    />
  );
}
