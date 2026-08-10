"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type SkymapLogoProps = {
  className?: string;
  priority?: boolean;
  variant?: "full" | "compact";
};

export function SkymapLogo({ className, priority = false, variant = "full" }: SkymapLogoProps) {
  const size =
    variant === "compact"
      ? { width: 120, height: 56 }
      : { width: 180, height: 84 };

  return (
    <Image
      src="/brand/skymap-logo.png"
      alt="SKYMAP"
      width={size.width}
      height={size.height}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}
