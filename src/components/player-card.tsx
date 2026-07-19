import type { CSSProperties } from "react";
import { type CardData, FRAMES, frameKey } from "@/lib/cards";
import { FitText } from "./fit-text";

/**
 * MTG-style Bayfield player trading card.
 *
 * ROBUSTNESS MODEL — the card is ONE scaling unit. The outer `@container` gives
 * the card a font-size proportional to its own width (`2.15cqw`), and EVERYTHING
 * inside is sized in `em` (block heights, gaps, padding, bevels, type). So the
 * whole card scales uniformly with its width and is perfectly self-similar: if it
 * looks right at one width it is identical at every width — it cannot "crush".
 * The four blocks (title/art/type/text) have fixed em heights, so every card is
 * the same shape; only the rules text varies, and <FitText> shrinks it to fit.
 */
export function PlayerCard({ card }: { card: CardData }) {
  const fk = frameKey(card);
  const pal = FRAMES[fk] ?? FRAMES.land;

  const vars = {
    fontSize: "2.15cqw", // 1em = 2.15% of card width → card is ~46.5em wide
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
      "0 0 0 0.1em rgba(0,0,0,.6),inset 0 0 0 0.14em rgba(255,244,205,.55),inset 0 0.3em 0.7em rgba(255,240,190,.5),inset 0 -1.2em 2em rgba(58,36,8,.55)",
  };
  const plateStyle: CSSProperties = {
    background:
      "linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 22%,rgba(0,0,0,.06) 60%,rgba(0,0,0,.16))," +
      "linear-gradient(180deg,var(--plate-hi) 0%,var(--plate-mid) 52%,var(--plate-lo) 100%)",
    boxShadow:
      "0 0 0 0.1em rgba(15,9,2,.55),0 0 0 0.3em var(--bev-lo),0 0 0 0.4em var(--bev-hi),inset 0 0.18em 0.18em rgba(255,252,244,.75),inset -0.18em -0.45em 0.55em rgba(28,17,5,.4)",
  };
  const bevel =
    "0 0 0 0.14em rgba(15,9,2,.7),0 0 0 0.55em var(--bev-lo),0 0 0 0.82em var(--bev-hi)";
  const artStyle: CSSProperties = {
    boxShadow: `${bevel},inset 0 0.3em 0.8em rgba(0,0,0,.6),inset 0 -0.2em 0.55em rgba(0,0,0,.45)`,
  };
  const boxStyle: CSSProperties = {
    background: "linear-gradient(180deg,var(--box-hi),var(--box-lo))",
    boxShadow: `${bevel},inset 0.1em 0.2em 0.3em rgba(255,255,255,.45),inset -0.2em -0.3em 0.5em rgba(120,90,50,.3)`,
  };

  return (
    <div className="@container w-full">
      <div
        style={vars}
        className="flex flex-col overflow-hidden rounded-[2.2em] bg-[#17140f] p-[1em_1.3em_0.55em] shadow-[0_2.4em_6em_-1.8em_rgba(0,0,0,.85)]"
      >
        {/* coloured frame — fixed-em blocks stacked in a flex column */}
        <div
          style={frameStyle}
          className="flex flex-col gap-[0.65em] rounded-[1.4em] p-[0.9em]"
        >
          {/* title bar */}
          <div
            style={plateStyle}
            className="flex h-[4em] shrink-0 items-center gap-[0.5em] rounded-[0.55em] pr-[0.7em] pl-[0.9em]"
          >
            <FitText
              center
              className="h-full flex-1 font-heading text-[2.15em] font-bold leading-none text-[#17140f] [text-shadow:0_0.05em_0_rgba(255,245,210,.5)]"
            >
              <span className="whitespace-nowrap">{card.name}</span>
            </FitText>
            {card.handicap && (
              <span className="grid aspect-square h-[2.4em] shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_38%_30%,#e6ddc9,#c3b596_60%,#9c8c68)] font-serif text-[1.4em] font-bold text-[#211b10] shadow-[-0.03em_0.12em_0_#000,inset_0_0.12em_0.12em_rgba(255,255,255,.6),inset_0_-0.12em_0.18em_rgba(0,0,0,.35)]">
                {card.handicap}
              </span>
            )}
          </div>

          {/* art window */}
          <div style={artStyle} className="h-[32.5em] shrink-0 overflow-hidden rounded-[0.15em]">
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
            className="flex h-[3.3em] shrink-0 items-center gap-[0.5em] rounded-[0.55em] pr-[0.6em] pl-[0.9em]"
          >
            <FitText
              center
              className="h-full flex-1 font-heading text-[1.55em] font-bold leading-none text-[#17140f]"
            >
              <span className="whitespace-nowrap">{card.type}</span>
            </FitText>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cards/logo.png"
              alt=""
              className="h-[2em] w-auto shrink-0 opacity-80 [filter:brightness(0)]"
            />
          </div>

          {/* rules + flavour text box — min height, GROWS to fit content so it
              can never clip (no fixed height, no JS measurement). A wordier card
              is simply a little taller; text is always fully visible. */}
          <div
            style={boxStyle}
            className="flex min-h-[18em] shrink-0 flex-col rounded-[0.25em] p-[1.1em_1.2em] font-serif text-[1.35em] leading-snug text-[#1a140d]"
          >
            <div className="pc-abilities flex flex-col gap-[0.5em]">
              {card.abilities.map((html, i) => (
                <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
              ))}
            </div>
            {card.flavor && (
              <>
                <div className="my-[0.7em] h-px bg-[linear-gradient(90deg,transparent,rgba(120,80,20,.75),transparent)]" />
                <p className="text-[0.95em] italic text-[#241a11]">{card.flavor}</p>
              </>
            )}
          </div>
        </div>

        {/* metadata (sits in the black bottom border) */}
        <div className="flex shrink-0 items-end justify-between px-[0.4em] pt-[0.55em] text-[#ededed]">
          <div className="leading-tight">
            <div className="text-[0.95em] font-bold tabular-nums tracking-wide">
              {card.collector}
              {card.rarity && <>&nbsp;★{card.rarity}</>}
            </div>
            <div className="text-[0.8em] tracking-wide opacity-90">
              BAY · EN · THE BAYFIELD OPEN
            </div>
          </div>
          <div className="text-[0.78em] opacity-85">™ &amp; © The Bayfield Open</div>
        </div>
      </div>
    </div>
  );
}
