import { ShieldCheck } from "lucide-react";
import { effectiveDropRate, GOKU_TEST_DROP_PERCENT, PITY_LIMIT, RARITY } from "@/lib/cards";
import { cn } from "@/lib/utils";

export function BoosterOdds({ counter, failed = false }: { counter: number | undefined; failed?: boolean }) {
  const count = Math.max(0, Math.min(PITY_LIMIT, counter ?? 0));
  return (
    <aside aria-label="Taux de drop et garantie Mythique" className="hub-odds mt-1 w-full max-w-lg rounded-md border border-foreground/10 bg-foreground/5 px-4 py-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>Taux de drop</span><span>Par carte</span>
      </div>
      {GOKU_TEST_DROP_PERCENT === 100 && <p className="mb-3 text-xs font-semibold text-rarity-legendaire">Mode Test : Goku 100 % · Éveil 100 %</p>}
      <ul className="grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-3">
        {(["commune", "non_commune", "rare", "epique", "legendaire", "mythique"] as const).map((rarity) => (
          <li key={rarity} className="flex items-center gap-2 text-[11px]">
            <span className={cn("size-1.5 shrink-0 rounded-full", rarity === "commune" ? "bg-flash" : RARITY[rarity].bg)} />
            <span className="whitespace-nowrap text-muted-foreground">{RARITY[rarity].label}</span>
            <span className="ml-auto whitespace-nowrap font-semibold tabular-nums">{String(effectiveDropRate(rarity)).replace(".", ",")} %</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-foreground/10 pt-3">
        <p aria-live="polite" className="flex items-center gap-2 text-xs font-medium">
          <ShieldCheck className="size-3.5 text-rarity-mythique" />
          <span>Garantie Mythique :</span>
          <span className="ml-auto tabular-nums">{failed ? "Indisponible" : counter === undefined ? "…" : count} / {PITY_LIMIT}</span>
        </p>
        <div role="progressbar" aria-label="Garantie Mythique" aria-valuemin={0} aria-valuemax={PITY_LIMIT} aria-valuenow={counter === undefined || failed ? undefined : count} className="mt-2.5 h-1.5 rounded-full bg-foreground/10">
          <div className="pity-progress h-full rounded-full" style={{ width: `${count / PITY_LIMIT * 100}%` }} />
        </div>
      </div>
    </aside>
  );
}