"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SeasonSelector({
  years,
  viewedYear,
  currentYear,
}: {
  years: number[];
  viewedYear: number;
  currentYear: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={String(viewedYear)}
      onValueChange={(v) => {
        // Swap the leading /[year] segment for the chosen year, keep the rest.
        const segments = pathname.split("/"); // e.g. ["", "2026", "day3", ...]
        segments[1] = v;
        const next = segments.join("/") || `/${v}`;
        startTransition(() => router.push(next));
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Select season"
        className="flex-shrink-0 border-white/25 bg-white/15 text-white data-placeholder:text-white/80 disabled:opacity-100"
        disabled={pending}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
            {y === currentYear ? " · current" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
