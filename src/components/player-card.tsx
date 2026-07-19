import type { CSSProperties } from "react";
import { type CardData, FRAMES, frameKey } from "@/lib/cards";

/**
 * MTG-style Bayfield player trading card. Pure flexbox column — the frame is a
 * vertical stack (title bar → art → type line → text box) so nothing overlaps.
 * Layout/spacing/type via Tailwind; the palette-driven textures, gradients and
 * beveled borders come from CSS vars set per frame (see lib/cards FRAMES).
 * Sizes use container-query units (cqw) so everything scales with the card.
 */
export function PlayerCard({ card }: { card: CardData }) {
  const fk = frameKey(card);
  const pal = FRAMES[fk] ?? FRAMES.land;

  const vars = {
    "--frame": `url(/cards/frames/${fk}.jpg)`,
    "--plate-hi": pal.plate[0],
    "--plate-mid": pal.plate[1],
    "--plate-lo": pal.plate[2],
    "--box-hi": pal.box[0],
    "--box-lo": pal.box[1],
    "--bev-lo": pal.bev[0],
    "--bev-hi": pal.bev[1],
  } as CSSProperties;

  const frameStyle: CSSProperties = {
    backgroundImage: "var(--frame)",
    backgroundSize: "130% 130%",
    backgroundPosition: "30% 20%",
    boxShadow:
      "0 0 0 1px rgba(0,0,0,.6),inset 0 0 0 1.5px rgba(255,244,205,.55),inset 0 3px 7px rgba(255,240,190,.5),inset 0 -12px 20px rgba(58,36,8,.6)",
  };
  const plateStyle: CSSProperties = {
    background:
      "linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 22%,rgba(0,0,0,.06) 60%,rgba(0,0,0,.16))," +
      "linear-gradient(180deg,var(--plate-hi) 0%,var(--plate-mid) 52%,var(--plate-lo) 100%)",
    boxShadow:
      "0 0 0 1px rgba(15,9,2,.55),0 0 0 3px var(--bev-lo),0 0 0 4px var(--bev-hi),inset 0 2px 2px rgba(255,252,244,.75),inset -2px -5px 6px rgba(28,17,5,.4)",
  };
  const bevel =
    "0 0 0 1.5px rgba(15,9,2,.7),0 0 0 6px var(--bev-lo),0 0 0 9px var(--bev-hi)";
  const artStyle: CSSProperties = {
    boxShadow: `${bevel},inset 0 3px 8px rgba(0,0,0,.6),inset 0 -2px 6px rgba(0,0,0,.45)`,
  };
  const boxStyle: CSSProperties = {
    background: "linear-gradient(180deg,var(--box-hi),var(--box-lo))",
    boxShadow: `${bevel},inset 1px 2px 3px rgba(255,255,255,.45),inset -2px -3px 5px rgba(120,90,50,.3)`,
  };

  return (
    <div
      style={vars}
      className="@container relative flex w-full flex-col overflow-hidden rounded-[5%/3.6%] bg-[#17140f] px-[3%] pt-[2.4%] pb-[1.4%] shadow-[0_24px_60px_-18px_rgba(0,0,0,.85)]"
    >
      {/* coloured frame — a vertical flex stack of the four zones (flows to content) */}
      <div
        style={frameStyle}
        className="flex flex-col gap-[1.6%] rounded-[2.5%/1.8%] p-[3.2%]"
      >
        {/* title bar */}
        <div
          style={plateStyle}
          className="flex shrink-0 items-center gap-2 rounded-[6px] py-[1.4%] pr-[3%] pl-[4%]"
        >
          <span className="min-w-0 flex-1 truncate font-heading text-[4.6cqw] font-bold text-[#17140f] [text-shadow:0_1px_0_rgba(255,245,210,.5)]">
            {card.name}
          </span>
          {card.handicap && (
            <span className="grid aspect-square w-[5.6cqw] shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_38%_30%,#e6ddc9,#c3b596_60%,#9c8c68)] font-serif text-[3.2cqw] font-bold text-[#211b10] shadow-[-0.5px_2px_0_#000,inset_0_2px_2px_rgba(255,255,255,.6),inset_0_-2px_3px_rgba(0,0,0,.35)]">
              {card.handicap}
            </span>
          )}
        </div>

        {/* art window */}
        <div
          style={artStyle}
          className="shrink-0 overflow-hidden rounded-[2px] aspect-[7/5]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.artSrc}
            alt={card.name}
            className="h-full w-full object-cover"
            style={{ objectPosition: card.artPosition ?? "50% 50%" }}
          />
        </div>

        {/* type line */}
        <div
          style={plateStyle}
          className="flex shrink-0 items-center gap-2 rounded-[6px] py-[1.1%] pr-[2%] pl-[4%]"
        >
          <span className="min-w-0 flex-1 truncate font-heading text-[3.15cqw] font-bold text-[#17140f]">
            {card.type}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cards/logo.png"
            alt=""
            className="h-[74%] w-auto shrink-0 opacity-80 [filter:brightness(0)]"
          />
        </div>

        {/* rules + flavour text box */}
        <div
          style={boxStyle}
          className="flex flex-col rounded-[3px] p-[5%_5.5%] font-serif text-[#1a140d]"
        >
          <div className="pc-abilities flex flex-col gap-[1.6%] text-[3.05cqw] leading-snug">
            {card.abilities.map((html, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
            ))}
          </div>
          {card.flavor && (
            <>
              <div className="my-[2.5%] h-px bg-[linear-gradient(90deg,transparent,rgba(120,80,20,.75),transparent)]" />
              <p className="text-[2.9cqw] italic leading-snug text-[#241a11]">
                {card.flavor}
              </p>
            </>
          )}
        </div>
      </div>

      {/* metadata (sits in the black bottom border) */}
      <div className="flex shrink-0 items-end justify-between px-[1%] pt-[1.4%] text-[#ededed]">
        <div className="leading-tight">
          <div className="text-[2.2cqw] font-bold tabular-nums tracking-wide">
            {card.collector}
            {card.rarity && <>&nbsp;★{card.rarity}</>}
          </div>
          <div className="text-[1.9cqw] tracking-wide opacity-90">
            BAY · EN · THE BAYFIELD OPEN
          </div>
        </div>
        <div className="text-[1.8cqw] opacity-85">™ &amp; © The Bayfield Open</div>
      </div>
    </div>
  );
}
