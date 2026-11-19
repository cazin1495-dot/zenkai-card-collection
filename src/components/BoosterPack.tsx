import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import packArt from "@/assets/zenkai-booster-pack.png.asset.json";
import type { Rarity } from "@/lib/cards";
import { packSealToken } from "@/lib/pack-opening";

export type PackState = "idle" | "opening" | "tearing";

const TEAR = 16; // % of the pack height that rips off

/** Foil seam illumination, left-to-right peel, then a perspective card stack. */
export function BoosterPack({
  state = "idle",
  accent = "var(--primary)",
  beam,
  className,
}: {
  state?: PackState;
  accent?: string;
  beam?: Rarity | null;
  className?: string;
}) {
  const beamColor = packSealToken(beam);
  const style = { "--accent": accent, "--beam": beamColor, "--tear-position": `${TEAR}%` } as CSSProperties;
  const tearing = state === "tearing";
  const img = <img src={packArt.url} alt="" draggable={false} className="absolute inset-0 size-full object-contain mix-blend-lighten" />;

  return (
    <div data-rarity={beam} className={cn("pack-opening-scene relative", className)} style={style}>
      {tearing && <div aria-hidden className="pack-reflection pointer-events-none absolute" />}
      <div className={cn("relative aspect-[1170/1532] w-60 sm:w-72", (state === "opening" || tearing) && "pack-micro-vibration")}>
        {tearing ? (
          <>
            <div aria-hidden className="pack-card-stack pointer-events-none absolute">
              {[2, 1, 0].map((i) => <div key={i} className="pack-stack-card card-back absolute inset-0 flex items-center justify-center border border-border font-display text-sm font-bold text-rarity-transcendance" style={{ transform: `translateZ(${-i * 4}px) translate(${i * 3}px, ${-i * 3}px)` }}>ZENKAI</div>)}
            </div>
            <div className="pack-sleeve absolute inset-0" style={{ clipPath: `inset(${TEAR}% 0 0 0)` }}>{img}</div>
            <div className="pack-cap absolute inset-0" style={{ clipPath: `inset(0 0 ${100 - TEAR}% 0)` }}><div className="pack-cap-peel absolute inset-0">{img}</div></div>
            <div aria-hidden className="pack-seal-light pointer-events-none absolute" />
          </>
        ) : (
          img
        )}
      </div>
    </div>
  );
}
