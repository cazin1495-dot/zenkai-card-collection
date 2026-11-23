import { createFileRoute, Link } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

/* Boutique complète : décommenter ces imports et ShopPage, puis utiliser ShopPage dans Route.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Coins, Package } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { gameQuery, type GameState } from "@/lib/game";
import { BOOSTER_COST } from "@/lib/economy";
import packArt from "@/assets/zenkai-booster-pack.png.asset.json";
*/

export const Route = createFileRoute("/boutique")({
  head: () => ({ meta: [
    { title: "Boutique — ZENKAI" }, { name: "description", content: "La Boutique Zenkai ouvrira prochainement." },
    { property: "og:title", content: "Boutique — ZENKAI" }, { property: "og:description", content: "La Boutique Zenkai ouvrira prochainement." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: ShopComingSoon,
});

export function ShopComingSoon() {
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-3xl items-center justify-center px-4 py-12 sm:px-6">
      <section className="w-full rounded-3xl border border-amber-400/40 bg-gradient-to-br from-violet-950 via-slate-950 to-violet-950 p-8 text-center shadow-[0_0_35px_rgba(168,85,247,0.2)] sm:p-12">
        <div className="mx-auto grid size-20 place-items-center rounded-full border border-amber-400/50 bg-amber-400/10 text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.25)]">
          <LockKeyhole aria-hidden className="size-10" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-black text-amber-200 sm:text-3xl">La Boutique ouvrira prochainement...</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-violet-100/80 sm:text-base">Prépare tes Zen ! Des packs exclusifs, des cadres d'avatar rares et des coffrets spéciaux arriveront dès l'ouverture officielle de Zenkai.</p>
        <Button variant="hero" className="mt-8 h-auto whitespace-normal" asChild>
          <Link to="/">Retourner ouvrir des boosters</Link>
        </Button>
      </section>
    </div>
  );
}

/*
function ShopPage() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const game = useQuery({ ...gameQuery(userId), enabled: !!session });
  const [pending, setPending] = useState(false);
  const [count, setCount] = useState(1);
  async function buy() {
    if (!session || pending) return;
    if (!window.confirm(`Acheter ${count} booster${count > 1 ? "s" : ""} pour ${count * BOOSTER_COST} Coins ?`)) return;
    setPending(true);
    try { const { data, error } = await supabase.rpc("buy_boosters", { _count: count }); if (error) throw error; queryClient.setQueryData(gameQuery(userId).queryKey, data as unknown as GameState); toast.success(`${count} booster${count > 1 ? "s" : ""} ajouté${count > 1 ? "s" : ""} à ton stock bonus.`); }
    catch { toast.error("Achat impossible. Vérifie ton solde de Coins."); await game.refetch(); }
    finally { setPending(false); }
  }
  return <div className="game-page mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <p className="game-eyebrow"><ShoppingBag className="size-4" /> BOUTIQUE ZENKAI</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">Boutique</h1>
    <div className="mt-5 flex items-center gap-2 text-sm text-rarity-legendaire"><Coins className="size-4" />{session ? `${game.data?.coins ?? "…"} Zenkai Coins` : "100 Coins / booster"}</div>
    {game.isError && <p role="alert" className="mt-4 text-sm text-destructive">Solde indisponible.<Button variant="link" onClick={() => game.refetch()}>Réessayer</Button></p>}
    <section className="mt-7 flex flex-col items-center border-y border-border py-7"><img loading="lazy" decoding="async" src={packArt.url} alt="Booster ZENKAI" className="w-44 mix-blend-lighten" /><h2 className="mt-4 font-display text-lg font-semibold">Booster ZENKAI</h2><p className="mt-2 text-xs text-muted-foreground">5 cartes · 7 raretés · {BOOSTER_COST} Coins</p>
      <div aria-label="Quantité de boosters" role="radiogroup" className="mt-5 flex gap-2">{[1, 5, 10].map(value => <Button key={value} role="radio" aria-checked={value === count} variant={count === value ? "hero" : "glass"} disabled={pending} onClick={() => setCount(value)}>×{value}</Button>)}</div>
      {session ? <Button variant="transcend" className="mt-5" disabled={pending || !game.data || game.data.coins < count * BOOSTER_COST} onClick={buy}><Coins className="size-4" />{pending ? "Achat en cours…" : `Acheter · ${count * BOOSTER_COST} Coins`}</Button> : <Button variant="hero" className="mt-5" asChild><Link to="/auth">Connexion</Link></Button>}
      {game.data && <p className="mt-3 text-xs text-muted-foreground">{game.data.bonus_boosters} boosters bonus disponibles</p>}
      <Button variant="glass" className="mt-5" asChild><Link to="/"><Package className="size-4" />Ouvrir mes boosters</Link></Button>
    </section>
  </div>;
}
*/