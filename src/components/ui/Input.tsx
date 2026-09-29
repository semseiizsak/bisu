import { type InputHTMLAttributes, forwardRef } from "react";
import { cx } from "@/lib/cx";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cx(
        "w-full rounded-2xl border-2 border-line-strong bg-surface px-4 py-3 font-bold text-ink placeholder:font-semibold placeholder:text-ink-faint",
        "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
        "focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
