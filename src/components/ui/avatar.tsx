import type { ComponentProps } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

function Avatar({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar"
      className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  alt,
  fill = true,
  sizes = "40px",
  ...props
}: Omit<ComponentProps<typeof Image>, "src" | "alt"> &
  Required<Pick<ComponentProps<typeof Image>, "src" | "alt">>) {
  return (
    <Image
      data-slot="avatar-image"
      alt={alt}
      fill={fill}
      sizes={sizes}
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
