import { type ComponentProps, forwardRef } from "react";

import { cn } from "../../lib/utils.js";

export const Button = forwardRef<HTMLButtonElement, ComponentProps<"button">>(function Button(
  { className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      data-slot="button"
      className={cn(
        "inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});
