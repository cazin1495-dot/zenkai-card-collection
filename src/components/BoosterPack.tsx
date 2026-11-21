import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { normalizeOpeningRarity, openingEffects, packSealToken } from "@/lib/pack-opening";

export type PackState = "idle" | "opening" | "tearing";

const TEAR = 16;

/** CSS-only collector pack; its seam peels away into the card stack on opening. */
export function BoosterPack({
  state = "idle",
  accent = "var(--primary)",
  category = "ZENKAI",
  beam,
  className,
}: {
  state?: PackState;
  accent?: string;
  category?: string;
  beam?: string | null;
  className?: string;
}) {
  const beamColor = packSealToken(beam);
  const rarity = normalizeOpeningRarity(beam);
  const style = {
    "--accent": accent,
    "--beam": beam ? beamColor : accent,
    "--tear-position": `${TEAR}%`,
  } as CSSProperties;
  const tearing = state === "tearing";
  const effects = openingEffects(beam);
  const packArt = () => (
    <div
      aria-hidden
      className="pack-art pack-art-css absolute inset-0"
      style={{ "--pack-illustration": 'url("/IMG_6616.png")' } as CSSProperties}
    >
      <div className="pack-art-panel absolute inset-[4%]">
        <span className="pack-art-kicker">LIMITED COLLECTOR EDITION</span>
        <span className="pack-art-category">{category}</span>
        <div className="pack-art-emblem" />
        <span className="pack-art-title">ZENKAI</span>
        <span className="pack-art-subtitle">ANIME CARD COLLECTION</span>
        <span className="pack-art-footer">5 CARTES ANIME</span>
      </div>
      <span className="pack-art-glint absolute inset-0" />
    </div>
  );

  return (
    <div
      data-rarity={rarity}
      data-state={state}
      className={cn("pack-opening-scene rarity-opening relative overflow-visible", className)}
      style={style}
    >
      <div aria-hidden className="pack-dynamic-aura pointer-events-none absolute" />
      {tearing && (
        <>
          <div aria-hidden className="pack-reflection pointer-events-none absolute" />
          <div aria-hidden className="pack-god-ray pointer-events-none absolute" />
        </>
      )}
      <div
        className={cn(
          "pack-body relative mx-auto h-[290px] w-[210px] overflow-visible",
          beam && (state === "opening" || tearing) && "pack-rarity-vibration",
        )}
      >
        {tearing ? (
          <>
            <div aria-hidden className="pack-card-stack pointer-events-none absolute">
              {[2, 1, 0].map((i) => (
                <div
                  key={i}
                  className="pack-stack-card card-back absolute inset-0 flex items-center justify-center border border-border font-display text-sm font-bold text-rarity-transcendance"
                  style={{
                    transform: `translateZ(${-i * 4}px) translate(${i * 3}px, ${-i * 3}px)`,
                  }}
                >
                  ZENKAI
                </div>
              ))}
            </div>
            <div
              className="pack-sleeve absolute inset-0"
              style={{ clipPath: `inset(${TEAR}% 0 0 0)` }}
            >
              {packArt()}
            </div>
            <div
              className="pack-cap absolute inset-0"
              style={{ clipPath: `inset(0 0 ${100 - TEAR}% 0)` }}
            >
              <div className="pack-cap-peel absolute inset-0">{packArt()}</div>
            </div>
            <div aria-hidden className="pack-seal-light pointer-events-none absolute" />
            <div aria-hidden className="pack-seam-effects pointer-events-none absolute">
              {Array.from({ length: effects.sparks }, (_, i) => (
                <span
                  key={i}
                  className="pack-seam-spark absolute"
                  style={
                    {
                      "--spark-x": `${Math.cos(i * 2.4) * (70 + i * 4)}px`,
                      "--spark-y": `${-35 - ((i * 23) % 145)}px`,
                      left: `${18 + (i * 61) / Math.max(1, effects.sparks - 1)}%`,
                      animationDelay: `${450 + (i % 5) * 35}ms`,
                    } as CSSProperties
                  }
                />
              ))}
              {Array.from({ length: effects.rays }, (_, i) => (
                <span
                  key={`ray-${i}`}
                  className="pack-seam-ray absolute"
                  style={{ "--ray-angle": `${(i - 3) * 18}deg` } as CSSProperties}
                />
              ))}
            </div>
            <div aria-hidden className="pack-opening-shards pointer-events-none absolute">
              {Array.from({ length: 12 }, (_, i) => (
                <span
                  key={i}
                  className="pack-opening-shard absolute"
                  style={
                    {
                      "--shard-x": `${(i % 2 ? 1 : -1) * (25 + Math.floor(i / 2) * 12)}px`,
                      "--shard-y": `${-35 - ((i * 19) % 125)}px`,
                      "--shard-delay": `${i * 32}ms`,
                      left: `${i % 2 ? 61 + (i % 4) * 3 : 39 - (i % 4) * 3}%`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <div
              aria-hidden
              className={cn(
                "pack-tear-flash pointer-events-none absolute inset-0",
                effects.jackpot && "pack-tear-flash-jackpot",
              )}
            />
          </>
        ) : (
          packArt()
        )}
      </div>
    </div>
  );
}
