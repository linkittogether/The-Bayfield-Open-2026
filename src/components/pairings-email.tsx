"use client";

import { Check, Copy, Mail } from "lucide-react";
import { useState } from "react";

// Ironwood pro shop — recipient for the pairings email.
const IRONWOOD_EMAIL = "proshop.ironwood@golfnorth.ca";

/**
 * Admin tool: the Saturday pairings email to the course. Shows the drafted text
 * (selectable), a copy-to-clipboard button, and an "open in email app" link.
 */
export function PairingsEmail({
  subject,
  body,
}: {
  subject: string;
  body: string;
}) {
  const [copied, setCopied] = useState(false);
  const mailto = `mailto:${IRONWOOD_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      // Clipboard blocked — the textarea below is selectable as a fallback.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-accent border border-secondary/40 rounded-xl p-4 space-y-3">
      <div>
        <p className="font-semibold text-sm">Email pairings to the course</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Copy the text or open it in your email app.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          To:{" "}
          <a href={`mailto:${IRONWOOD_EMAIL}`} className="text-primary underline">
            {IRONWOOD_EMAIL}
          </a>
        </p>
      </div>
      <textarea
        readOnly
        value={body}
        rows={Math.min(16, body.split("\n").length + 1)}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full text-sm rounded-lg border border-border bg-white p-3 font-mono resize-y"
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copy}
          className="h-10 rounded-lg bg-primary text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-95"
        >
          {copied ? (
            <>
              <Check size={15} /> Copied
            </>
          ) : (
            <>
              <Copy size={15} /> Copy text
            </>
          )}
        </button>
        <a
          href={mailto}
          className="h-10 rounded-lg border border-primary/30 bg-primary/5 text-primary text-sm font-medium flex items-center justify-center gap-2 active:scale-95"
        >
          <Mail size={15} /> Open in email
        </a>
      </div>
    </div>
  );
}
