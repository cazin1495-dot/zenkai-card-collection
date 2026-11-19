import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import packArt from "@/assets/zenkai-booster-pack.png.asset.json";
import type { Rarity } from "@/lib/cards";

export type PackState = "idle" | "opening" | "tearing";

const TEAR = 16; // % of the pack height that rips off

/** A clean metallic cut with a restrained reflection in the best rarity's colour. */
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
  const beamColor = beam === "transcendance" ? "var(--rarity-transcendance)" : beam ? `var(--rarity-${beam})` : accent;
  const style = { "--accent": accent, "--beam": beamColor, "--tear-position": `${TEAR}%` } as CSSProperties;
  const tearing = state === "tearing";
  const img = <img src={packArt.url} alt="" draggable={false} className="absolute inset-0 size-full object-contain mix-blend-lighten" />;

  return (
    <div className={cn("relative", className)} style={style}>
      {tearing && <div aria-hidden className="pack-reflection pointer-events-none absolute" />}
      <div className={cn("relative aspect-[1170/1532] w-60 sm:w-72", (state === "opening" || tearing) && "pack-micro-vibration")}>
        {tearing ? (
          <>
            <div className="absolute inset-0" style={{ clipPath: `inset(${TEAR}% 0 0 0)` }}>{img}</div>
            <div className="pack-cap absolute inset-0" style={{ clipPath: `inset(0 0 ${100 - TEAR}% 0)` }}>{img}</div>
            <div aria-hidden className="pack-laser-cut pointer-events-none absolute" />
          </>
        ) : (
          img
        )}
      </div>
    </div>
  );
}
