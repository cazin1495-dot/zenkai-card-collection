import type { CSSProperties } from "react";
import { normalizeOpeningRarity, packSealToken } from "@/lib/pack-opening";

/** Outlives the pack so the actual draw colour carries into every reveal. */
export function OpeningAura({ rarity, stage }: { rarity: string | null; stage: "tearing" | "reveal" | "summary" }) {
  return <div aria-hidden data-rarity={normalizeOpeningRarity(rarity)} data-stage={stage} className="opening-afterglow rarity-opening pointer-events-none absolute inset-0" style={{ "--beam": packSealToken(rarity) } as CSSProperties}>
    <div className="opening-afterglow-halo absolute" />
    <div key={stage} className="opening-afterglow-flash absolute inset-0" />
    {Array.from({ length: 18 }, (_, index) => <span key={index} className="opening-afterglow-particle opening-shard absolute" style={{ left: `${12 + index * 37 % 76}%`, top: `${20 + index * 23 % 65}%`, animationDelay: `${-index * 0.23}s` }} />)}
  </div>;
}