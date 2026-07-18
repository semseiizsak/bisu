import { type ButtonHTMLAttributes, forwardRef } from "react";
import Link, { type LinkProps } from "next/link";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "tap-target inline-flex items-center justify-center gap-2 rounded-md font-extrabold " +
  "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)] " +
  "disabled:opacity-40 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-[color:var(--color-paper)]";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink/90 active:bg-ink/80",
  secondary: "bg-surface text-ink border border-line-strong hover:border-ink/40",
  ghost: "text-ink hover:bg-ink/5 active:bg-ink/10",
  danger: "bg-bad text-paper hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-base px-4 py-2.5",
  lg: "text-lg px-6 py-3.5",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(base, variants[variant], sizes[size], className);
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ className, variant = "primary", size = "md", ...props }, ref) => {
  return <button ref={ref} className={buttonClasses(variant, size, className)} {...props} />;
});
Button.displayName = "Button";

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: LinkProps & { className?: string; variant?: Variant; size?: Size; children?: React.ReactNode }) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
