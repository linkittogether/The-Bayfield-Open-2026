"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { firstName } from "@/lib/format";
import { importMatchFromGrint } from "@/lib/server/day3";

export function GrintPullMatchButton({
  matchId,
  truffleName,
  syndicateName,
}: {
  matchId: number;
  truffleName: string;
  syndicateName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function pull() {
    start(async () => {
      try {
        const r = await importMatchFromGrint(matchId);
        const missing = [
          !r.truffleFound && firstName(truffleName),
          !r.syndicateFound && firstName(syndicateName),
        ].filter(Boolean);
        if (r.holesWritten > 0) {
          toast.success(`Imported ${r.holesWritten} holes from The Grint`);
        }
        if (missing.length) {
          toast.message(`No Sunday round found on The Grint for ${missing.join(" & ")}.`);
        } else if (r.holesWritten === 0) {
          toast.message("Both rounds found, but no matching holes to import yet.");
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Pull failed");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={pull}
      disabled={pending}
      className="w-full h-11 rounded-xl border border-border bg-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
    >
      <Download size={15} />
      {pending ? "Pulling from The Grint…" : "Pull match from The Grint"}
    </button>
  );
}
