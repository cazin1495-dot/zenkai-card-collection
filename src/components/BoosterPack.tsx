import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { normalizeOpeningRarity, openingEffects, packSealToken } from "@/lib/pack-opening";
import { PACK_ARTWORK } from "@/lib/cards";
import { BoosterArtwork } from "@/components/BoosterArtwork";

export type PackState = "idle" | "opening" | "tearing";

const TEAR = 15;

/** CSS-only pack opening with a horizontal tear and a card revealed behind it. */
export function BoosterPack({
  state = "idle",
  accent = "var(--primary)",
  category = "ZENKAI",
  artwork = PACK_ARTWORK,
  beam,
  className,
}: {
  state?: PackState;
  accent?: string;
  category?: string;
  artwork?: string;
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
      className="pack-art pack-art-css absolute inset-0 h-80 w-48 overflow-hidden rounded-xl"
    >
      <BoosterArtwork
        src={artwork}
        alt=""
        className="pack-art-image h-full w-full scale-x-[1.15] scale-y-[1.12] rounded-xl object-cover drop-shadow-[0_15px_35px_rgba(168,85,247,0.35)]"
      />
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
      <span className="pack-category-badge mt-6">{category}</span>
      {tearing && (
        <>
          <div aria-hidden className="pack-reflection pointer-events-none absolute" />
        </>
      )}
      <div
        className={cn(
          "pack-body relative mx-auto h-80 w-48 overflow-visible",
          beam && state === "opening" && "pack-rarity-vibration",
        )}
      >
        {tearing ? (
          <>
            <div aria-hidden className="pack-first-card absolute left-1/2 top-1/2 mx-auto h-[268px] w-48 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-transparent">
              <img
                src="/image_39f4fe98.jpg"
                alt=""
                className="h-full w-full scale-[1.12] rounded-2xl bg-transparent object-cover"
              />
            </div>
            <div
              className="pack-sleeve absolute inset-0"
              style={{ clipPath: `inset(${TEAR}% 0 0 0)` }}
            >
              {packArt()}
            </div>
            <div
              className="pack-cap absolute inset-0"
            >
              <div
                className="pack-cap-peel absolute inset-0"
                style={{ clipPath: `inset(0 0 ${100 - TEAR}% 0)` }}
              >
                {packArt()}
              </div>
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
