"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { playerLogin } from "@/lib/auth-actions";

export function PinLoginForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await playerLogin(formData);
      if (res.ok) router.push("/");
      else setError(res.error);
    });
  }

  if (!open) {
    return (
      <p className="text-center mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          No Google account? Sign in with a PIN
        </button>
      </p>
    );
  }

  return (
    <form action={submit} className="mt-4 space-y-4">
      <div className="bg-white border border-border rounded-xl p-5 space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Enter the PIN an admin set for you.
        </p>

        <div className="space-y-2">
          <Label htmlFor="pin-code">PIN</Label>
          <Input
            id="pin-code"
            name="pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
            placeholder="4-digit PIN"
            className="text-center text-xl tracking-widest h-12"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200 text-center">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={pending || pin.length !== 4}
        className="w-full h-12 text-base"
      >
        {pending ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <LogIn size={18} /> Log in
          </>
        )}
      </Button>

      <p className="text-center">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Back to Google sign-in
        </button>
      </p>
    </form>
  );
}
