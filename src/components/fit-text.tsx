"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Shrinks its content's font-size until it fits the box (both width and height).
 * The box takes its size from the surrounding layout (a fixed card block) and
 * sets the base font-size via className; FitText only scales DOWN from there.
 *
 * The inner wrapper is left at its NATURAL size (not h-full) so its scrollHeight
 * reflects the real content height — otherwise overflow can't be detected and
 * text clips instead of shrinking. Children should size relatively (em/inherit).
 * `center` vertically centres single-line content (title/type); otherwise the
 * content is top-aligned (rules box). Re-fits on resize and after fonts load.
 */
export function FitText({
  children,
  className,
  style,
  center = false,
  minPct = 35,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  center?: boolean;
  minPct?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const b = box.current;
    const el = inner.current;
    if (!b || !el) return;

    const fit = () => {
      let pct = 100;
      el.style.fontSize = "100%";
      const overflows = () =>
        el.scrollHeight > b.clientHeight + 0.5 || el.scrollWidth > b.clientWidth + 0.5;
      for (let i = 0; i < 40 && pct > minPct && overflows(); i++) {
        pct -= 3;
        el.style.fontSize = `${pct}%`;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  });

  return (
    <div
      ref={box}
      className={className}
      style={{
        minWidth: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: center ? "center" : "flex-start",
        ...style,
      }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
