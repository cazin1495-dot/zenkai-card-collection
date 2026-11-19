import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Combine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/AnimeCard";
import { TranscendButton } from "@/components/Transcendance";
import { useAuth } from "@/hooks/use-auth";
import { cardsQuery, collectionQuery } from "@/lib/queries";

export const Route = createFileRoute("/eveil")({
  head: () => ({ meta: [
    { title: "Éveil & Fusion — ZENKAI" },
    { name: "description", content: "Retrouve tes cartes Mythiques et tente leur éveil Transcendance dans ZENKAI." },
    { property: "og:title", content: "Éveil & Fusion — ZENKAI" },
    { property: "og:description", content: "Tes cartes Mythiques prêtes pour la Transcendance." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: AwakeningPage,
});

function AwakeningPage() {
  const { session } = useAuth();
  const cards = useQuery(cardsQuery);
  const owned = useQuery({ ...collectionQuery(session?.user.id ?? ""), enabled: !!session });
  const eligible = (owned.data ?? []).filter(copy => !copy.awaken_attempted).flatMap(copy => {
    const card = cards.data?.find(card => card.id === copy.card_id && card.rarity === "mythique");
    return card ? [{ copy, card }] : [];
  });
  return <div className="game-page mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <p className="game-eyebrow"><Sparkles className="size-4" /> ATELIER TRANSCENDANCE</p>
    <h1 className="mt-3 text-3xl font-black sm:text-4xl">Éveil & Fusion</h1>
    <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Combine className="size-4 text-rarity-legendaire" /> Fusion · Bientôt disponible</div>
    {!session ? <Button variant="hero" className="mt-8" asChild><Link to="/auth">Connexion</Link></Button> : eligible.length ? <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">{eligible.map(({ copy, card }) => <div key={copy.id} className="flex flex-col items-center gap-3"><AnimeCard card={card} /><TranscendButton userCardId={copy.id} card={card} /></div>)}</div> : <div className="py-16 text-center"><Sparkles className="mx-auto size-10 text-rarity-legendaire" /><p className="mt-4 text-muted-foreground">Aucune carte Mythique prête à l’éveil.</p><Button variant="glass" className="mt-5" asChild><Link to="/">Ouvrir des boosters</Link></Button></div>}
  </div>;
}