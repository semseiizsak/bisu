import { type InputHTMLAttributes, forwardRef } from "react";
import { cx } from "@/lib/cx";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cx(
          "w-full rounded-md border border-line-strong bg-surface px-4 py-2.5 text-ink placeholder:text-ink-faint",
          "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
          "focus:outline-none focus:border-ink",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
