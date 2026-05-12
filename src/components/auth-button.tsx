"use client";

import { LogOut, Shield } from "lucide-react";
import { useTransition } from "react";
import { logout } from "@/lib/auth-actions";
import { firstName } from "@/lib/format";

interface AuthButtonProps {
  kind: "player" | "admin";
  name: string;
}

export function AuthButton({ kind, name }: AuthButtonProps) {
  const [pending, startTransition] = useTransition();
  const Icon = kind === "admin" ? Shield : LogOut;
  return (
    <button
      onClick={() => startTransition(() => logout())}
      title="Log out"
      disabled={pending}
      className="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex-shrink-0 max-w-[140px] disabled:opacity-50"
    >
      <Icon
        size={13}
        className={kind === "admin" ? "text-yellow-300 flex-shrink-0" : "flex-shrink-0"}
      />
      <span className="text-xs text-white font-semibold truncate leading-none">
        {firstName(name)}
      </span>
    </button>
  );
}
