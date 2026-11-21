import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZenkaiPlus } from "./ZenkaiPlus";
import { getGuestBalance } from "@/lib/guest-collection";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: null, guest: true }),
}));

describe("Zenkai+ local demo", () => {
  beforeEach(() => localStorage.clear());

  it("activates once, selects an avatar, and can be disabled and reactivated", async () => {
    render(<ZenkaiPlus />);
    fireEvent.click(screen.getByRole("button", { name: "Zenkai+" }));
    expect(screen.getByText(/mode test gratuit/i)).toBeTruthy();
    const activate = await screen.findByRole("button", { name: "Activer Zenkai+ (Mode Test)" });
    await waitFor(() => expect(activate).toBeEnabled());
    fireEvent.click(activate);
    expect(getGuestBalance()).toBe(800);
    const avatar = screen.getByRole("button", { name: "Goku Ultra Instinct" });
    fireEvent.click(avatar);
    expect(avatar).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Désactiver Zenkai+" }));
    fireEvent.click(screen.getByRole("button", { name: "Activer Zenkai+ (Mode Test)" }));
    expect(getGuestBalance()).toBe(800);
    expect(screen.getByRole("button", { name: "Goku Ultra Instinct" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
