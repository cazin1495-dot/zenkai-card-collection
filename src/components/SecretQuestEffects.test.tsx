import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSecretQuests, recordBoosterOpen } from "@/lib/quests";
import { getGuestBalance, updateGuestState } from "@/lib/guest-collection";
import { getPlayerXp } from "@/lib/level";
import { SecretQuestEffects } from "./SecretQuestEffects";

describe("révélation des succès secrets", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("ignore les champs, reconnaît les séquences et affiche les révélations successives", () => {
    const { unmount } = render(
      <>
        <SecretQuestEffects />
        <input aria-label="Recherche" />
      </>,
    );
    const input = screen.getByLabelText("Recherche");
    for (const key of "zenkai") fireEvent.keyDown(input, { key });
    expect(getSecretQuests().unlocked).toEqual([]);
    for (const key of "zenkai") fireEvent.keyDown(window, { key });
    expect(getSecretQuests().unlocked).toEqual(["word"]);
    expect(screen.getByRole("status")).toHaveTextContent("Chercheur de Faille");
    expect(screen.getByRole("status")).toHaveTextContent("Taper zenkai au clavier");
    expect(screen.getByRole("status")).toHaveTextContent("+600 Zen · +350 XP");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Récompenses créditées : +600 Zen · +350 XP",
    );
    expect(getGuestBalance()).toBe(1100);
    expect(getPlayerXp()).toBe(350);
    expect(screen.getByRole("status")).toHaveTextContent("Clique n'importe où pour continuer");
    for (const key of [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "B",
      "A",
    ])
      fireEvent.keyDown(window, { key });
    expect(getSecretQuests().unlocked).toEqual(["word", "konami"]);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("status")).toHaveTextContent("Chercheur de Faille");
    fireEvent.click(screen.getByRole("button", { name: "Fermer la révélation" }));
    expect(screen.getByRole("status")).toHaveTextContent("Le Code Konami");
    expect(screen.getByRole("status")).toHaveTextContent(/\+1\s*500 Zen · \+500 XP/);
    expect(screen.getByRole("status")).toHaveTextContent("Titre débloqué : Légende Rétro");
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("status")).toHaveTextContent("Le Code Konami");
    fireEvent.click(screen.getByRole("button", { name: "Fermer la révélation" }));
    expect(screen.queryByRole("status")).toBeNull();
    unmount();
  });

  it("exige dix clics consécutifs sur le logo sans bloquer la navigation", () => {
    render(
      <>
        <SecretQuestEffects />
        <a data-secret-logo href="#accueil">
          Logo
        </a>
        <button>Autre</button>
      </>,
    );
    const logo = screen.getByText("Logo");
    for (let i = 0; i < 9; i++) fireEvent.click(logo);
    fireEvent.click(screen.getByText("Autre"));
    fireEvent.click(logo);
    expect(getSecretQuests().unlocked).toEqual([]);
    for (let i = 0; i < 9; i++) fireEvent.click(logo);
    expect(getSecretQuests().unlocked).toEqual(["clicker"]);
    expect(screen.getByRole("status")).toHaveTextContent("Le Cliqueteur Fou");
  });

  it("met en file les succès débloqués par la même action", () => {
    render(<SecretQuestEffects />);
    act(() => recordBoosterOpen(null, 1, [], [], new Date(2026, 0, 1, 0, 0)));
    expect(screen.getByRole("status")).toHaveTextContent("Collectionneur Nocturne");
    fireEvent.click(screen.getByRole("button", { name: "Fermer la révélation" }));
    expect(screen.getByRole("status")).toHaveTextContent("Vœu à 11h11");
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("status")).toHaveTextContent("Vœu à 11h11");
    fireEvent.click(screen.getByRole("button", { name: "Fermer la révélation" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("crédite les anciens cadeaux au montage sans réinitialiser les succès", () => {
    updateGuestState((state) => ({
      state: {
        ...state,
        secrets: {
          unlocked: ["clicker", "word"],
          claimed: ["clicker"],
          recycled: 0,
          clickerResetDone: true,
        },
      },
      result: undefined,
    }));
    const { unmount } = render(<SecretQuestEffects />);
    expect(getSecretQuests().unlocked).toEqual(["clicker", "word"]);
    expect(getSecretQuests().claimed).toEqual(["clicker", "word"]);
    expect(getGuestBalance()).toBe(1100);
    expect(getPlayerXp()).toBe(350);
    unmount();
    const next = render(<SecretQuestEffects />);
    expect(getGuestBalance()).toBe(1100);
    expect(getPlayerXp()).toBe(350);
    next.unmount();
  });
});
