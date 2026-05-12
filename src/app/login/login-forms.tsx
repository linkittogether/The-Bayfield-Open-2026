"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogIn, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminLogin, playerLogin } from "@/lib/auth-actions";

interface PlayerOption {
  id: number;
  name: string;
  hasPin: boolean;
}

interface LoginFormsProps {
  players: PlayerOption[];
}

export function LoginForms({ players }: LoginFormsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // player tab state
  const [selectedId, setSelectedId] = useState<string>("");
  const [pin, setPin] = useState("");

  // admin tab state
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");

  const selected = players.find((p) => String(p.id) === selectedId);

  function submitPlayer(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await playerLogin(formData);
      if (res.ok) router.push("/");
      else setError(res.error);
    });
  }

  function submitAdmin(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await adminLogin(formData);
      if (res.ok) router.push("/");
      else setError(res.error);
    });
  }

  return (
    <Tabs
      defaultValue="player"
      onValueChange={() => setError(null)}
      className="w-full"
    >
      <TabsList className="grid grid-cols-2 w-full mb-6 h-12">
        <TabsTrigger value="player" className="gap-2">
          <User size={16} /> Player Login
        </TabsTrigger>
        <TabsTrigger value="admin" className="gap-2">
          <Shield size={16} /> Admin Login
        </TabsTrigger>
      </TabsList>

      <TabsContent value="player">
        <form action={submitPlayer} className="space-y-4">
          <div className="bg-white border border-border rounded-xl p-5 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Log in to enter your own scores and track your progress.
            </p>

            <div className="space-y-2">
              <Label htmlFor="player-select">Your Name</Label>
              <Select
                value={selectedId}
                onValueChange={(v) => {
                  setSelectedId(v);
                  setError(null);
                }}
              >
                <SelectTrigger id="player-select" className="w-full" size="default">
                  <SelectValue placeholder="— Select your name —" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                      {!p.hasPin ? " (no PIN set)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="playerId" value={selectedId} />
              {selected && !selected.hasPin && (
                <p className="text-xs text-amber-600">
                  This player has no PIN. Ask an admin to set one in the Admin
                  panel.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="player-pin">PIN</Label>
              <Input
                id="player-pin"
                name="pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your PIN"
                className="text-center text-xl tracking-widest h-12"
              />
            </div>
          </div>

          {error && <ErrorBanner message={error} />}

          <Button
            type="submit"
            disabled={pending || !selectedId || pin.length !== 4}
            className="w-full h-12 text-base"
          >
            {pending ? <Spinner /> : (
              <>
                <LogIn size={18} /> Log In as Player
              </>
            )}
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="admin">
        <form action={submitAdmin} className="space-y-4">
          <div className="bg-white border border-border rounded-xl p-5 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Admins can edit scores, handicaps, and manage all tournament
              settings.
            </p>

            <div className="space-y-2">
              <Label htmlFor="admin-username">Username</Label>
              <Input
                id="admin-username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                placeholder="Admin username"
                autoCapitalize="none"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-code">Access Code</Label>
              <Input
                id="admin-code"
                name="code"
                type="password"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                placeholder="Access code"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && <ErrorBanner message={error} />}

          <Button
            type="submit"
            disabled={pending || !username.trim() || !code}
            className="w-full h-12 text-base"
          >
            {pending ? <Spinner /> : (
              <>
                <Shield size={18} /> Log In as Admin
              </>
            )}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200 text-center">
      {message}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}
