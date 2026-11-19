import { cn } from "@/lib/utils";
import ryujin from "@/assets/characters/ryujin.jpg";

/** Stylised foil booster pack. */
export function BoosterPack({ shaking, className }: { shaking?: boolean; className?: string }) {
  return (
    <div className={cn(shaking ? "animate-pack-shake" : "animate-pack-float", className)}>
      <div className="booster-pack relative aspect-[5/8] w-56 overflow-hidden rounded-xl shadow-glow sm:w-64">
        <img src={ryujin} alt="" className="absolute inset-0 size-full object-cover opacity-50 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-transparent to-background/90" />
        <div className="holo-sheen absolute inset-0 animate-sheen opacity-70" />
        <div className="absolute inset-x-0 top-6 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-primary-foreground/80">
            Booster
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-1">
          <p className="font-display text-4xl font-black tracking-tight text-primary-foreground">ZENKAI</p>
          <p className="rounded-full border border-primary-foreground/30 bg-background/40 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground backdrop-blur">
            3 cartes
          </p>
        </div>
      </div>
    </div>
  );
}
