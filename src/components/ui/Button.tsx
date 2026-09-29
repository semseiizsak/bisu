import { type ButtonHTMLAttributes, forwardRef } from "react";
import Link, { type LinkProps } from "next/link";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "good" | "gold" | "sky" | "violet";
type Size = "sm" | "md" | "lg";

const base =
  "tap-target press inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold " +
  "disabled:opacity-40 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-[color:var(--color-paper)]";

/** Chunky buttons: a solid bottom edge (the "deep" colour) that sinks on press. */
const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-[0_4px_0_0_var(--color-accent-deep)] [--press-color:var(--color-accent-deep)]",
  good: "bg-good text-white shadow-[0_4px_0_0_var(--color-good-deep)] [--press-color:var(--color-good-deep)]",
  gold: "bg-gold text-ink shadow-[0_4px_0_0_var(--color-gold-deep)] [--press-color:var(--color-gold-deep)]",
  sky: "bg-sky text-white shadow-[0_4px_0_0_var(--color-sky-deep)] [--press-color:var(--color-sky-deep)]",
  violet: "bg-violet text-white shadow-[0_4px_0_0_var(--color-violet-deep)] [--press-color:var(--color-violet-deep)]",
  secondary:
    "bg-surface text-ink border-2 border-line-strong shadow-[0_4px_0_0_var(--color-line-strong)] [--press-color:var(--color-line-strong)]",
  ghost: "text-ink-muted hover:bg-ink/5 active:bg-ink/10 shadow-none",
  danger: "bg-bad text-white shadow-[0_4px_0_0_var(--color-bad-deep)] [--press-color:var(--color-bad-deep)]",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-3.5 py-2",
  md: "text-base px-5 py-3",
  lg: "text-lg px-6 py-4",
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
