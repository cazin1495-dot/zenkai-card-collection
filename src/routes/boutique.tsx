import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import packArt from "@/assets/zenkai-booster-pack.png.asset.json";

export const Route = createFileRoute("/boutique")({
  head: () => ({ meta: [
    { title: "Boutique — ZENKAI" }, { name: "description", content: "La boutique de cartes et boosters ZENKAI ouvrira prochainement." },
    { property: "og:title", content: "Boutique — ZENKAI" }, { property: "og:description", content: "Découvre prochainement la boutique ZENKAI." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { property: "og:image", content: packArt.url }, { name: "twitter:image", content: packArt.url },
  ] }), component: ShopPage,
});
function ShopPage() {
  return <div className="game-page mx-auto max-w-6xl px-4 py-8 sm:px-6"><p className="game-eyebrow"><ShoppingBag className="size-4" /> BOUTIQUE ZENKAI</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">Boutique</h1><div className="flex flex-col items-center py-8"><img src={packArt.url} alt="Booster ZENKAI" className="w-44 mix-blend-screen" /><p className="mt-6 font-display text-lg text-rarity-legendaire">Bientôt disponible</p><Button variant="glass" className="mt-5" asChild><Link to="/"><ArrowLeft /> Retour aux boosters</Link></Button></div></div>;
}