"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={String(viewedYear)}
      onValueChange={(v) => {
        // Switching seasons always returns to that season's home — a Day 3 page
        // from one year rarely maps to a meaningful spot in another.
        startTransition(() => router.push(`/${v}`));
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Select season"
        className="flex-shrink-0 border-white/25 bg-white/15 text-white data-placeholder:text-white/80 disabled:opacity-100"
        disabled={pending}
      >
        {/* Year only on mobile to save header width; full label from sm up.
            The dropdown items still show "· current". */}
        <span className="sm:hidden">{viewedYear}</span>
        <span className="hidden sm:inline">
          {viewedYear}
          {viewedYear === currentYear ? " · current" : ""}
        </span>
      </SelectTrigger>
      {/* Anchor to the trigger (popper) and align to its right edge. The
          default item-aligned positioning collapses to the viewport's top-left
          on narrow mobile screens when the trigger sits at the right. */}
      <SelectContent position="popper" align="end" sideOffset={4}>
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
