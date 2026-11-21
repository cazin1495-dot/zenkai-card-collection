import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, Repeat2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/echanges")({
  validateSearch: (search: Record<string, unknown>) => ({
    pseudo: typeof search["pseudo"] === "string" ? search["pseudo"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Échanges — Zenkai" },
      { name: "description", content: "Échange tes cartes en double avec les autres joueurs Zenkai." },
      { property: "og:title", content: "Échanges — Zenkai" },
      { property: "og:description", content: "Échange tes cartes en double avec les autres joueurs Zenkai." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TradesPage,
});

const steps = [
  { icon: Repeat2, title: "Repère tes doubles", text: "Les cartes ×2 et plus de ta collection peuvent être proposées." },
  { icon: Users, title: "Trouve un joueur", text: "Parcours les offres des autres collectionneurs." },
  { icon: ArrowLeftRight, title: "Échange", text: "Propose un échange carte contre carte, l'autre joueur accepte." },
];

function TradesPage() {
  const { pseudo } = Route.useSearch();
  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-10 text-center sm:px-6">
      <span className="inline-flex rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-semibold text-accent">
        Bientôt disponible
      </span>
      <h1 className="mt-4 text-3xl font-black sm:text-5xl">
        Les <span className="text-gradient-primary">échanges</span> arrivent
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        Bientôt, tu pourras échanger tes cartes en double pour compléter ta collection.
      </p>
      {pseudo && <div className="mx-auto mt-6 max-w-sm text-left">
        <label htmlFor="trade-pseudo" className="text-sm font-semibold">Pseudo du joueur</label>
        <Input id="trade-pseudo" className="mt-2" value={pseudo} readOnly />
        <p className="mt-2 text-xs text-muted-foreground">Les échanges réels ne sont pas encore disponibles.</p>
      </div>}
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.title} className="rounded-md border border-border bg-foreground/5 p-6 text-left backdrop-blur-xl">
            <s.icon className="size-6 text-primary" />
            <p className="mt-4 font-display text-sm font-bold">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </div>
      <Button variant="hero" className="mt-10 rounded-full" asChild>
        <Link to="/">Ouvrir un booster en attendant</Link>
      </Button>
    </div>
  );
}
