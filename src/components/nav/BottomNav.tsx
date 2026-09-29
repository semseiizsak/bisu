"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { TodayIcon, ReadingIcon, GamesIcon, ProgressIcon } from "@/components/nav/icons";

const TABS = [
  { href: "/ma", label: "Ma", Icon: TodayIcon, color: "text-accent bg-accent/12" },
  { href: "/olvasas", label: "Olvasás", Icon: ReadingIcon, color: "text-sky bg-sky/12" },
  { href: "/jatekok", label: "Játékok", Icon: GamesIcon, color: "text-violet bg-violet/12" },
  { href: "/haladas", label: "Haladás", Icon: ProgressIcon, color: "text-gold-deep bg-gold/18" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Fő navigáció"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {TABS.map(({ href, label, Icon, color }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cx(
                  "tap-target flex flex-col items-center gap-0.5 py-2 text-[11px]",
                  "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
                  active ? "text-ink" : "text-ink-faint",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cx(
                    "flex h-9 w-14 items-center justify-center rounded-2xl transition-[transform,background-color] duration-[var(--dur-standard)] ease-[var(--ease-pop)]",
                    active ? `${color} scale-105` : "bg-transparent",
                  )}
                >
                  <Icon width={24} height={24} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={active ? "font-black" : "font-bold"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
