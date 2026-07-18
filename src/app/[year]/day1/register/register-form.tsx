"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Check, Minus, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createPlayerFromForm } from "@/lib/server/players";

export function RegisterForm() {
  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function reset() {
    setName("");
    setHandicap(0);
    setPhoto(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Please enter a name");

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("handicap", String(handicap));
    if (photo) fd.set("photo", photo);

    startTransition(async () => {
      try {
        await createPlayerFromForm(fd);
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          reset();
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Registration failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-28 h-28 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden transition-colors hover:bg-accent"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Camera size={28} />
              <span className="text-xs">Add Photo</span>
            </div>
          )}
          <div className="absolute bottom-1 right-1 bg-primary text-white rounded-full p-1">
            <Camera size={12} />
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={pickPhoto}
          className="hidden"
        />
        <p className="text-xs text-muted-foreground mt-2">Optional photo</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-name">
          <User size={14} className="inline mr-1" /> Player Name *
        </Label>
        <Input
          id="register-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
        />
      </div>

      <div>
        <Label className="block mb-2">Handicap</Label>
        <div className="flex items-center gap-4 bg-white border border-border rounded-xl p-2">
          <button
            type="button"
            onClick={() => setHandicap((h) => Math.max(0, h - 1))}
            className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center active:scale-95"
          >
            <Minus size={18} />
          </button>
          <span className="flex-1 text-center text-2xl font-bold">{handicap}</span>
          <button
            type="button"
            onClick={() => setHandicap((h) => Math.min(54, h + 1))}
            className="w-11 h-11 rounded-lg bg-primary text-white flex items-center justify-center active:scale-95"
          >
            <Plus size={18} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Net score = Gross − ½ Handicap
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={pending || success}
        className={cn(
          "w-full h-12 text-base",
          success && "bg-green-500 hover:bg-green-500",
        )}
      >
        {success ? (
          <>
            <Check size={18} /> Registered!
          </>
        ) : pending ? (
          <Spinner />
        ) : (
          "Register Player"
        )}
      </Button>
    </form>
  );
}

function Spinner() {
  return (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}
