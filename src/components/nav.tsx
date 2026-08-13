"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const ITEMS = [
  { href: "/", label: "Home" },
  { href: "/library", label: "Library" },
  { href: "/graph", label: "Graph" },
  { href: "/add", label: "Add" },
  { href: "/search", label: "Find" },
];

export function Nav({ topicCount }: { topicCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="w-48 shrink-0 border-r border-divider bg-surface flex flex-col justify-between py-6 px-4">
      <div>
        <Link
          href="/"
          className="font-heading text-xl block mb-8 tracking-wide"
          aria-label="Learning Inventory — home"
        >
          LI
        </Link>
        <ul className="space-y-1">
          {ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block text-sm uppercase tracking-wider py-2 px-2 rounded transition-colors ${
                    active
                      ? "text-text font-medium bg-bg"
                      : "text-text/60 hover:text-text hover:bg-bg/60"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <div className="text-xs text-text/50 px-2 mb-4">
          <div className="text-lg font-heading text-text/80">{topicCount}</div>
          topics
        </div>
        <ThemeToggle />
      </div>
    </nav>
  );
}
