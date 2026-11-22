import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGuestBalance } from "@/lib/guest-collection";
import { getQuestState, recordQuestActivity } from "@/lib/quests";
import { MissionsPage } from "./eveil";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  session: { user: { id: "alice" } } as { user: { id: string } } | null,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: mocks.session }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/components/MissionsPanel", () => ({ MissionsPanel: () => <div>Missions locales</div> }));
vi.mock("@/components/LocalLevel", () => ({ LocalLevel: () => null }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

function serverState() {
  return {
    username: "Alice",
    coins: 500,
    xp: 0,
    level: 1,
    bonus_boosters: 0,
    boosters_stored: 15,
    stock_updated_at: "2026-01-01T12:00:00Z",
    reward_packs: {},
    cosmetics: {},
    mission_started_at: "2026-01-01T12:00:00Z",
    mission_opened: 3,
    mission_recycled: 2,
    mission_claims: [] as string[],
  };
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MissionsPage />
    </QueryClientProvider>,
  );
}

describe("réclamation groupée des missions", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.rpc.mockReset();
    mocks.success.mockReset();
    mocks.error.mockReset();
    mocks.session = { user: { id: "alice" } };
  });

  it("réclame les deux progressions locales et les missions en ligne en un clic", async () => {
    recordQuestActivity(null, "boosters", 3);
    recordQuestActivity("alice", "boosters", 10);
    const state = serverState();
    mocks.rpc.mockImplementation(async (name: string, args?: { _mission: string }) => {
      if (name === "claim_mission" && args) {
        state.mission_claims.push(args._mission);
        state.coins += args._mission === "login" ? 100 : 50;
        state.xp += args._mission === "open" ? 30 : args._mission === "recycle" ? 25 : 0;
        if (state.mission_claims.length === 3) state.bonus_boosters++;
      }
      return { data: structuredClone(state), error: null };
    });
    mount();
    const button = await screen.findByRole("button", { name: "Tout réclamer (6)" });
    fireEvent.click(button);
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith(
        "Missions réclamées : +590 Zen locaux · +200 XP locaux · +200 Coins · +55 XP en ligne · 1 booster(s) bonus",
      ),
    );
    expect(getGuestBalance()).toBe(1090);
    expect(getQuestState(null).dailyClaimed).toEqual(["open3"]);
    expect(getQuestState("alice").dailyClaimed).toEqual(["open3", "open10"]);
    expect(state.mission_claims).toEqual(["login", "open", "recycle"]);
    expect(await screen.findByRole("button", { name: "Tout réclamer (0)" })).toBeDisabled();
  });

  it("signale une erreur serveur après les missions déjà confirmées", async () => {
    recordQuestActivity(null, "boosters", 3);
    const state = serverState();
    mocks.rpc.mockImplementation(async (name: string, args?: { _mission: string }) => {
      if (name === "claim_mission" && args?._mission === "login") {
        state.mission_claims.push("login");
        state.coins += 100;
      } else if (name === "claim_mission") {
        return { data: null, error: { message: "connexion perdue" } };
      }
      return { data: structuredClone(state), error: null };
    });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Tout réclamer (4)" }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "connexion perdue. Confirmé : 1 mission(s) locale(s), +120 Zen, +50 XP ; 1 mission(s) en ligne, +100 Coins",
        ),
      ),
    );
    expect(getGuestBalance()).toBe(620);
    expect(state.mission_claims).toEqual(["login"]);
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("réclame les missions locales sans appel serveur pour un invité", async () => {
    mocks.session = null;
    recordQuestActivity(null, "boosters", 10);
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Tout réclamer (2)" }));
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith(
        "Missions réclamées : +470 Zen locaux · +150 XP locaux",
      ),
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Tout réclamer (0)" })).toBeDisabled();
  });

  it("ne réclame rien si l'état serveur ne peut pas être actualisé", async () => {
    recordQuestActivity(null, "boosters", 3);
    const state = serverState();
    let reads = 0;
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "game_state" && reads++ === 0)
        return { data: structuredClone(state), error: null };
      return { data: null, error: { message: "connexion indisponible" } };
    });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Tout réclamer (4)" }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("connexion indisponible")),
    );
    expect(getGuestBalance()).toBe(500);
    expect(getQuestState(null).dailyClaimed).toEqual([]);
  });
});
