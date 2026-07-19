"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Shrinks its content's font-size until it fits the box (both width and height).
 * The box takes its size from the surrounding layout (a fixed card block); the
 * base font-size is whatever `className`/`style` set — FitText only scales DOWN
 * from there. Children should size relatively (em/inherit), not in absolute
 * units, so they scale together. Re-fits on resize and after fonts load.
 */
export function FitText({
  children,
  className,
  style,
  minPct = 45,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
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
    <div ref={box} className={className} style={{ minWidth: 0, overflow: "hidden", ...style }}>
      <div ref={inner} className="h-full w-full">
        {children}
      </div>
    </div>
  );
}
