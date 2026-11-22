import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ShopComingSoon } from "./boutique";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

it("annonce la future boutique et propose le retour aux boosters", () => {
  render(<ShopComingSoon />);
  expect(
    screen.getByRole("heading", { name: "La Boutique ouvrira prochainement..." }),
  ).toBeVisible();
  expect(
    screen.getByText(
      "Prépare tes Zen ! Des packs exclusifs, des cadres d'avatar rares et des coffrets spéciaux arriveront dès l'ouverture officielle de Zenkai.",
    ),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Retourner ouvrir des boosters" })).toHaveAttribute(
    "href",
    "/",
  );
  expect(screen.queryByRole("button", { name: /Acheter/ })).toBeNull();
});
