import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BetaGate } from "./BetaGate";
import { BETA_ACCESS_KEY, BETA_END, BETA_WIPE_KEY } from "@/lib/beta";
import { getGuestBalance } from "@/lib/guest-collection";

const mocks = vi.hoisted(() => ({
  auth: { session: null as { user: { id: string } } | null, ready: true },
  signOut: vi.fn(),
  google: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: mocks.signOut } } }));
vi.mock("@/lib/auth", () => ({ signInWithGoogle: mocks.google }));

function showGate() {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}><BetaGate><p>Application</p></BetaGate></QueryClientProvider>);
}

describe("écran bêta", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(BETA_END) - 60_000);
    mocks.auth.session = null;
    mocks.auth.ready = true;
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
    mocks.google.mockReset().mockResolvedValue({ error: null });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("keeps Google available and grants the pack after a valid code", async () => {
    showGate();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Continuer avec Google" })); });
    expect(mocks.google).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText("Code d'accès bêta"), { target: { value: "invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Accéder à la bêta" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Code bêta invalide");
    fireEvent.change(screen.getByLabelText("Code d'accès bêta"), { target: { value: "zenkai7" } });
    fireEvent.click(screen.getByRole("button", { name: "Accéder à la bêta" }));
    expect(screen.getByText("Application")).toBeTruthy();
    expect(getGuestBalance()).toBe(1000);
  });

  it("cleans local progress at the deadline, signs out and allows the creator shortcut", async () => {
    localStorage.setItem(BETA_ACCESS_KEY, "granted");
    localStorage.setItem("zenkai_player_profile", "test");
    mocks.auth.session = { user: { id: "player" } };
    showGate();
    expect(screen.getByText("Application")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(localStorage.getItem("zenkai_player_profile")).toBeNull();
    expect(localStorage.getItem(BETA_WIPE_KEY)).toBe("done");
    expect(screen.getByText(/données locales de test/)).toBeTruthy();
    expect(screen.getByText(/remise à zéro des données des comptes en ligne reste à effectuer/)).toBeTruthy();
    const logo = screen.getByRole("button", { name: "ZENKAI" });
    for (let i = 0; i < 5; i++) fireEvent.click(logo);
    expect(screen.getByText("Application")).toBeTruthy();
  });

  it("allows the creator shortcut without crediting the welcome pack", () => {
    showGate();
    const logo = screen.getByRole("button", { name: "ZENKAI" });
    for (let i = 0; i < 5; i++) fireEvent.click(logo);
    expect(screen.getByText("Application")).toBeTruthy();
    expect(getGuestBalance()).toBe(500);
  });

  it("reports a sign-out failure and retries without claiming the closure succeeded", async () => {
    vi.setSystemTime(Date.parse(BETA_END) + 10_000);
    mocks.auth.session = { user: { id: "player" } };
    mocks.signOut.mockResolvedValueOnce({ error: new Error("session indisponible") });
    showGate();
    await act(async () => {});
    expect(screen.getByRole("alert")).toHaveTextContent("session indisponible");
    expect(screen.queryByText(/données locales de test de cet appareil ont été remises à zéro/)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Réessayer" })); });
    expect(mocks.signOut).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/données locales de test de cet appareil ont été remises à zéro/)).toBeTruthy();
  });
});
