"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectSeason } from "@/lib/server/seasons";

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
        startTransition(async () => {
          await selectSeason(Number(v));
          router.refresh();
        });
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
