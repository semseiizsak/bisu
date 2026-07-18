"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { TodayIcon, ReadingIcon, GamesIcon, ProgressIcon } from "@/components/nav/icons";

const TABS = [
  { href: "/ma", label: "Ma", Icon: TodayIcon },
  { href: "/olvasas", label: "Olvasás", Icon: ReadingIcon },
  { href: "/jatekok", label: "Játékok", Icon: GamesIcon },
  { href: "/haladas", label: "Haladás", Icon: ProgressIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Fő navigáció"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cx(
                  "tap-target flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                  "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
                  active ? "text-ink" : "text-ink-faint hover:text-ink-muted",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={active ? "text-accent" : undefined} />
                <span className={active ? "font-extrabold" : "font-medium"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
