"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deleteAdmin, upsertAdmin } from "@/lib/server/admins";

interface AdminLite {
  id: number;
  username: string;
}

export function AdminManager({ admins }: { admins: AdminLite[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !code.trim()) return;
    setMsg(null);
    startTransition(async () => {
      try {
        await upsertAdmin({ username: username.trim(), code: code.trim() });
        setMsg("Admin added!");
        setUsername("");
        setCode("");
        router.refresh();
        setTimeout(() => {
          setShowAdd(false);
          setMsg(null);
        }, 1200);
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function remove(id: number) {
    startTransition(async () => {
      try {
        await deleteAdmin(id);
        router.refresh();
      } catch {
        // surfaced via reload of the row count
      }
    });
  }

  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Shield size={16} /> Admins
        </h3>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-primary px-2 py-1 rounded-lg hover:bg-primary/10"
        >
          <Plus size={14} /> Add Admin
        </button>
      </div>

      {showAdd && (
        <form onSubmit={add} className="mb-3 p-3 bg-muted/50 rounded-xl space-y-2">
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoCapitalize="none"
          />
          <Input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
          />
          {msg && (
            <p
              className={cn(
                "text-xs text-center",
                msg === "Admin added!" ? "text-green-600" : "text-red-600",
              )}
            >
              {msg}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAdd(false)}
              className="flex-1 h-9"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="flex-1 h-9">
              {pending ? "Adding…" : "Add Admin"}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {admins.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40"
          >
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-primary" />
              <span className="text-sm font-medium">{a.username}</span>
            </div>
            {a.username !== "admin" && (
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
