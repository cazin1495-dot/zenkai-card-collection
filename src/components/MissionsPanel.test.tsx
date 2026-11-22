import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MissionsPanel, useMissionData } from "./MissionsPanel";
import { getGuestBalance } from "@/lib/guest-collection";
import { recordQuestActivity, unlockSecret } from "@/lib/quests";
import { getPlayerXp } from "@/lib/level";
import { toast } from "sonner";
import { LocalLevel } from "./LocalLevel";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: null }) }));
vi.mock("@/lib/queries", () => ({
  cardsQuery: { queryKey: ["cards"], queryFn: async () => [] },
  collectionQuery: () => ({ queryKey: ["collection"], queryFn: async () => [] }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function TestMissions() {
  const { ready } = useMissionData(null);
  return <><span aria-label="Récompenses disponibles">{ready}</span><MissionsPanel accountId={null} /></>;
}

describe("missions panel", () => {
  beforeEach(() => localStorage.clear());
  it("reacts to booster activity and credits the local balance", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><TestMissions /></QueryClientProvider>);
    act(() => recordQuestActivity(null, "boosters", 3));
    expect(screen.getByLabelText("Récompenses disponibles")).toHaveTextContent("1");
    const row = screen.getByText("Ouvrir 3 boosters aujourd'hui").parentElement!.parentElement!;
    fireEvent.click(within(row).getByRole("button", { name: "Réclamer" }));
    expect(getGuestBalance()).toBe(620);
    expect(within(row).getByRole("button", { name: "Réclamée" })).toBeDisabled();
    expect(screen.getByLabelText("Récompenses disponibles")).toHaveTextContent("0");
  });

  it("displays and claims the daily bonus with immediate local rewards", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MissionsPanel accountId={null} /></QueryClientProvider>);
    const bonus = screen.getByRole("region", { name: "Bonus de connexion journalier" });
    expect(within(bonus).getByText(/Série : 0\/7 jours/)).toBeTruthy();
    expect(within(bonus).getByText("Jour 7 · Coffret Ultime")).toBeTruthy();
    fireEvent.click(within(bonus).getByRole("button", { name: "Réclamer le bonus du jour" }));
    expect(getGuestBalance()).toBe(600);
    expect(getPlayerXp()).toBe(50);
    expect(within(bonus).getByRole("button", { name: "Réclamé aujourd'hui" })).toBeDisabled();
    expect(within(bonus).getByText("Réclamé")).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith("Bonus Jour 1 réclamé : +100 Zen & +50 XP ★");
  });

  it("refreshes the shared bonus after midnight and when switching mission scopes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 23, 59));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(<QueryClientProvider client={client}><MissionsPanel accountId="alice" /></QueryClientProvider>);
    try {
      const bonus = screen.getByRole("region", { name: "Bonus de connexion journalier" });
      fireEvent.click(within(bonus).getByRole("button", { name: "Réclamer le bonus du jour" }));
      fireEvent.click(screen.getByRole("button", { name: "Collection locale" }));
      expect(within(bonus).getByRole("button", { name: "Réclamé aujourd'hui" })).toBeDisabled();
      act(() => vi.advanceTimersByTime(60_000));
      expect(within(bonus).getByRole("button", { name: "Réclamer le bonus du jour" })).toBeEnabled();
      fireEvent.click(within(bonus).getByRole("button", { name: "Réclamer le bonus du jour" }));
      expect(getGuestBalance()).toBe(750);
      expect(getPlayerXp()).toBe(125);
      expect(toast.success).toHaveBeenCalledWith("Bonus Jour 2 réclamé : +150 Zen & +75 XP ★");
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("ne liste pas les secrets et débloque leur titre automatiquement dans le profil", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><LocalLevel /><MissionsPanel accountId={null} /></QueryClientProvider>);
    expect(screen.queryByRole("region", { name: "Missions secrètes" })).toBeNull();
    expect(screen.queryByText("??? · Mission Secrète")).toBeNull();
    act(() => unlockSecret("konami"));
    expect(screen.queryByRole("region", { name: "Missions secrètes" })).toBeNull();
    expect(screen.queryByText("Le Code Konami")).toBeNull();
    expect(screen.queryByRole("button", { name: "Réclamer le cadeau" })).toBeNull();
    expect(getGuestBalance()).toBe(2000);
    expect(getPlayerXp()).toBe(500);
    expect(screen.getByText(/Titres débloqués : Légende Rétro/)).toBeTruthy();
  });
});
