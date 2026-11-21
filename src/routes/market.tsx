import { createFileRoute } from "@tanstack/react-router";
import { LocalMarket } from "@/components/LocalMarket";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Marché — Zenkai" },
      { name: "description", content: "Achète et vends des cartes sur le marché local Zenkai." },
    ],
  }),
  component: MarketPage,
});

export function MarketPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6">
      <p className="game-eyebrow">MARCHÉ ZENKAI</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">Marché</h1>
      <LocalMarket />
    </div>
  );
}
