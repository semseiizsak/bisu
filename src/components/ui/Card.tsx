import { type HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-3xl border-2 border-line bg-surface", className)} {...props} />;
}
