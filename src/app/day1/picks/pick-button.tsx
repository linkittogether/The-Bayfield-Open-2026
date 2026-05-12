"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitDay1Pick } from "@/lib/server/day1";

export function PickButton({
  pickerId,
  pickedId,
  disabled,
  children,
}: {
  pickerId: number;
  pickedId: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);

  function pick() {
    setPicking(true);
    startTransition(async () => {
      try {
        await submitDay1Pick({ pickerPlayerId: pickerId, pickedPlayerId: pickedId });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to make pick");
        setPicking(false);
      }
    });
  }

  return (
    <button
      type="button"
      disabled={disabled || pending || picking}
      onClick={pick}
      className="w-full bg-white rounded-xl border border-border p-3 flex items-center gap-3 active:scale-[0.97] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      {children}
    </button>
  );
}
