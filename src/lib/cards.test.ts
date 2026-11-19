import { describe, expect, it } from "vitest";
import { cooldownRemaining, formatCountdown, CARDS_PER_BOOSTER } from "./cards";

const opened = new Date("2026-11-19T12:00:00Z");

describe("booster cooldown", () => {
  it("is available when the player never opened a booster", () => {
    expect(cooldownRemaining(null, opened.getTime())).toBe(0);
  });

  it("waits 10 minutes after an opening", () => {
    expect(cooldownRemaining(opened, opened.getTime())).toBe(10 * 60 * 1000);
    expect(formatCountdown(cooldownRemaining(opened, opened.getTime()))).toBe("10:00");
  });

  it("shows 09:00 one minute after opening", () => {
    expect(formatCountdown(cooldownRemaining(opened, opened.getTime() + 60_000))).toBe("09:00");
  });

  it("unlocks exactly 10 minutes after opening", () => {
    expect(cooldownRemaining(opened, opened.getTime() + 10 * 60 * 1000)).toBe(0);
  });
});

describe("booster content", () => {
  it("contains 3 cards", () => {
    expect(CARDS_PER_BOOSTER).toBe(3);
  });
});
