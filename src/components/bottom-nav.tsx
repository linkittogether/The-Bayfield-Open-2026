"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Sailboat, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav({ year }: { year: number }) {
  const pathname = usePathname();
  const base = `/${year}`;
  const items = [
    { href: base, label: "Home", icon: Sailboat, match: (p: string) => p === base },
    {
      href: `${base}/day1/leaderboard`,
      label: "Day 1",
      icon: Flag,
      match: (p: string) => p.startsWith(`${base}/day1`),
    },
    {
      href: `${base}/day2/leaderboard`,
      label: "Day 2",
      icon: Users,
      match: (p: string) => p.startsWith(`${base}/day2`),
    },
    {
      href: `${base}/day3/leaderboard`,
      label: "Day 3",
      icon: Trophy,
      match: (p: string) => p.startsWith(`${base}/day3`),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50">
      <div className="max-w-lg mx-auto flex">
        {items.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <Link key={it.href} href={it.href} className="flex-1">
              <div
                className={cn(
                  "w-full flex flex-col items-center gap-0.5 py-2 px-1 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon size={20} />
                <span>{it.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
