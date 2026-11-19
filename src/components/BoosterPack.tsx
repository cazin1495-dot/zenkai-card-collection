import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import packArt from "@/assets/zenkai-booster-pack.png.asset.json";
import type { Rarity } from "@/lib/cards";

export type PackState = "idle" | "opening" | "tearing";

const TEAR = 16; // % of the pack height that rips off

/** The Zenkai booster pack. While tearing, a beam in the best rarity's colour bursts out. */
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
    <div className={cn("relative", state === "idle" && "animate-pack-float", className)} style={style}>
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[130%] -translate-x-1/2 -translate-y-1/2 animate-halo rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--accent) 55%, transparent), transparent 65%)" }}
      />
      <div className={cn("relative aspect-[1170/1532] w-60 sm:w-72", (state === "opening" || tearing) && "animate-pack-rumble")}>
        {tearing ? (
          <>
            <div className="absolute inset-0" style={{ clipPath: `inset(${TEAR}% 0 0 0)` }}>{img}</div>
            <div className="absolute inset-0 animate-tear-off" style={{ clipPath: `inset(0 0 ${100 - TEAR}% 0)` }}>{img}</div>
            <div aria-hidden className="pack-crack pointer-events-none absolute" />
            <div aria-hidden className="pack-crack-core pointer-events-none absolute" />
            {Array.from({ length: 7 }, (_, i) => <div key={`ray-${i}`} aria-hidden className="pack-god-ray pointer-events-none absolute"
              style={{ "--ray-angle": `${(i - 3) * 14}deg`, "--ray-delay": `${i * 0.035}s` } as CSSProperties} />)}
            {Array.from({ length: 24 }, (_, i) => <span key={`ember-${i}`} aria-hidden className="pack-ember pointer-events-none absolute"
              style={{ left: `${8 + (i * 17 % 84)}%`, "--ember-drift": `${(i % 2 ? 1 : -1) * (20 + i * 3)}px`, animationDelay: `${i % 8 * 0.09}s` } as CSSProperties} />)}
            <div aria-hidden className="pack-tear-flash pointer-events-none absolute" />
            {beam === "transcendance" && (
              <div aria-hidden className="pointer-events-none absolute left-1/2 w-[120%] -translate-x-1/2 animate-beam bg-gradient-rainbow opacity-70 mix-blend-screen blur-md" style={{ bottom: `${100 - TEAR}%`, height: "120vh", clipPath: "polygon(42% 100%, 58% 100%, 85% 0, 15% 0)" }} />
            )}
            {(beam === "legendaire" || beam === "mythique") && <Bolts />}
          </>
        ) : (
          img
        )}
      </div>
    </div>
  );
}

function Bolts() {
  const paths = ["M20 0 L35 40 L22 42 L40 90", "M80 5 L64 38 L78 40 L58 95", "M50 0 L44 30 L56 34 L46 70"];
  return (
    <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute -top-[60%] left-0 h-[80%] w-full animate-beam">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--beam)" strokeWidth="1.6" className="animate-bolt" style={{ animationDelay: `${i * 0.12}s`, filter: "drop-shadow(0 0 3px var(--beam))" }} />
      ))}
    </svg>
  );
}
