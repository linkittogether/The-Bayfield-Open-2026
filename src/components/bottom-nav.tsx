"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Sailboat, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Sailboat, prefix: "/" },
  { href: "/day1/leaderboard", label: "Day 1", icon: Flag, prefix: "/day1" },
  { href: "/day2/leaderboard", label: "Day 2", icon: Users, prefix: "/day2" },
  { href: "/day3/leaderboard", label: "Day 3", icon: Trophy, prefix: "/day3" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50">
      <div className="max-w-lg mx-auto flex">
        {items.map((it) => {
          const active =
            it.prefix === "/" ? pathname === "/" : pathname.startsWith(it.prefix);
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
