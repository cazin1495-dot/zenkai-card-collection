import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import packArt from "@/assets/zenkai-booster-pack.png.asset.json";
import { normalizeOpeningRarity, openingEffects, packSealToken } from "@/lib/pack-opening";

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
  beam?: string | null;
  className?: string;
}) {
  const beamColor = packSealToken(beam);
  const rarity = normalizeOpeningRarity(beam);
  const style = { "--accent": accent, "--beam": beamColor, "--tear-position": `${TEAR}%` } as CSSProperties;
  const tearing = state === "tearing";
  const effects = openingEffects(beam);
  const img = <img src={packArt.url} alt="" draggable={false} className="pack-art absolute inset-0 size-full object-contain mix-blend-screen" />;

  return (
    <div data-rarity={rarity} data-state={state} className={cn("pack-opening-scene rarity-opening relative overflow-visible", className)} style={style}>
      <div aria-hidden className="pack-dynamic-aura pointer-events-none absolute" />
      {tearing && <div aria-hidden className="pack-reflection pointer-events-none absolute" />}
      <div className={cn("pack-body relative aspect-[1170/1532] w-60 overflow-visible sm:w-72", beam && (state === "opening" || tearing) && "pack-rarity-vibration")}>
        {tearing ? (
          <>
            <div aria-hidden className="pack-card-stack pointer-events-none absolute">
              {[2, 1, 0].map((i) => <div key={i} className="pack-stack-card card-back absolute inset-0 flex items-center justify-center border border-border font-display text-sm font-bold text-rarity-transcendance" style={{ transform: `translateZ(${-i * 4}px) translate(${i * 3}px, ${-i * 3}px)` }}>ZENKAI</div>)}
            </div>
            <div className="pack-sleeve absolute inset-0" style={{ clipPath: `inset(${TEAR}% 0 0 0)` }}>{img}</div>
            <div className="pack-cap absolute inset-0" style={{ clipPath: `inset(0 0 ${100 - TEAR}% 0)` }}><div className="pack-cap-peel absolute inset-0">{img}</div></div>
            <div aria-hidden className="pack-seal-light pointer-events-none absolute" />
            <div aria-hidden className="pack-seam-effects pointer-events-none absolute">
              {Array.from({ length: effects.sparks }, (_, i) => <span key={i} className="pack-seam-spark absolute" style={{ "--spark-x": `${Math.cos(i * 2.4) * (70 + i * 4)}px`, "--spark-y": `${-35 - (i * 23 % 145)}px`, left: `${18 + i * 61 / Math.max(1, effects.sparks - 1)}%`, animationDelay: `${450 + i % 5 * 35}ms` } as CSSProperties} />)}
              {Array.from({ length: effects.rays }, (_, i) => <span key={`ray-${i}`} className="pack-seam-ray absolute" style={{ "--ray-angle": `${(i - 3) * 18}deg` } as CSSProperties} />)}
            </div>
            <div aria-hidden className={cn("pack-tear-flash pointer-events-none absolute inset-0", effects.jackpot && "pack-tear-flash-jackpot")} />
          </>
        ) : (
          img
        )}
      </div>
    </div>
  );
}
