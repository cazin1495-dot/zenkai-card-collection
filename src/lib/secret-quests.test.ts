import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Card, type PulledCard } from "./cards";
import { getGuestBalance, getGuestState, updateGuestState } from "./guest-collection";
import { getPlayerXp } from "./level";
import {
  creditPendingSecrets,
  getSecretQuests,
  observeQuestCollection,
  recordBoosterOpen,
  recordQuestActivity,
  recordSecretDraw,
  readSecretQuests,
  SECRET_QUESTS,
  unlockSecret,
  type SecretQuestId,
} from "./quests";

const card = (id: string, series: string, rarity: Card["rarity"] = "commune"): Card => ({
  id,
  series,
  rarity,
  name: id,
  title: "",
  description: "",
  sort_order: 0,
});
const pull = (id: string, rarity: Card["rarity"], transcended = false): PulledCard => ({
  userCardId: id,
  card: card(id, "", rarity),
  transcended,
});

describe("succès secrets locaux", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 30));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("débloque les horaires exacts après ouverture, une fois et après sauvegarde", () => {
    recordBoosterOpen(null, 1, [], [], new Date(2026, 0, 1, 5, 0));
    recordBoosterOpen(null, 1, [], [], new Date(2026, 0, 1, 22, 23));
    expect(getSecretQuests().unlocked).toEqual([]);
    const listener = vi.fn(() => expect(getSecretQuests().unlocked).toContain("night"));
    window.addEventListener("zenkai:secret-unlocked", listener);
    recordBoosterOpen(null, 1, [], [], new Date(2026, 0, 1, 4, 59));
    recordBoosterOpen(null, 1, [], [], new Date(2026, 0, 1, 4, 59));
    expect(getSecretQuests().unlocked).toEqual(["night"]);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("zenkai:secret-unlocked", listener);
    recordBoosterOpen(null, 1, [], [], new Date(2026, 0, 1, 22, 22));
    expect(getSecretQuests().unlocked).toEqual(["night", "mirror"]);
  });

  it("débloque simultanément les deux succès à minuit", () => {
    const listener = vi.fn(() => {
      expect(getSecretQuests().claimed).toEqual(["night", "mirror"]);
      expect(getPlayerXp()).toBe(675);
      expect(getGuestBalance()).toBe(2211);
    });
    window.addEventListener("zenkai:secret-unlocked", listener);
    recordBoosterOpen(null, 1, [], [], new Date(2026, 0, 1, 0, 0));
    expect(getSecretQuests().unlocked).toEqual(["night", "mirror"]);
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener("zenkai:secret-unlocked", listener);
  });

  it("cumule les recyclages entre jours et collections", () => {
    recordQuestActivity(null, "recycled", 30);
    vi.setSystemTime(new Date(2026, 0, 2, 12));
    recordQuestActivity("account", "recycled", 19);
    expect(getSecretQuests().unlocked).not.toContain("recycle");
    recordQuestActivity("account", "recycled", 1);
    expect(getSecretQuests()).toMatchObject({
      recycled: 50,
      unlocked: ["recycle"],
      claimed: ["recycle"],
    });
    expect(getGuestBalance()).toBe(800);
    expect(getPlayerXp()).toBe(400);
  });

  it("compte les cartes mythiques et les copies transcendées uniquement dans un x10", () => {
    const results = [pull("a", "mythique"), pull("b", "commune", true)];
    recordSecretDraw(1, results);
    recordSecretDraw(10, [results[0]!]);
    expect(getSecretQuests().unlocked).not.toContain("miracle");
    recordSecretDraw(10, results);
    expect(getSecretQuests().unlocked).toContain("miracle");
  });

  it("compte les identités distinctes par série et par collection", () => {
    const dragon = Array.from({ length: 7 }, (_, i) =>
      card(`d${i}`, i % 2 ? "Dragon Ball Super" : "Dragon Ball"),
    );
    const crew = Array.from({ length: 10 }, (_, i) => card(`p${i}`, "One Piece"));
    const copies = (cards: Card[]) =>
      cards.map((item) => ({ card_id: item.id, transcended: false }));
    observeQuestCollection(
      null,
      [...dragon, ...crew],
      [
        ...copies(dragon.slice(0, 6)),
        ...copies(crew.slice(0, 9)),
        ...copies([dragon[0]!, crew[0]!]),
      ],
    );
    expect(getSecretQuests().unlocked).toEqual([]);
    observeQuestCollection("other", [...dragon, ...crew], copies([dragon[6]!, crew[9]!]));
    expect(getSecretQuests().unlocked).toEqual([]);
    observeQuestCollection(null, [...dragon, ...crew], copies([...dragon, ...crew]));
    expect(getSecretQuests().unlocked).toEqual(["dragon", "crew"]);
  });

  it.each([
    ["night", 500, 250, "Oiseau de Nuit"],
    ["recycle", 300, 150, undefined],
    ["zero", 500, 300, "Joueur Sans Filet"],
    ["miracle", 800, 500, "Béni des Dieux"],
    ["clicker", 500, 200, undefined],
    ["word", 600, 350, undefined],
    ["mirror", 1111, 400, undefined],
    ["dragon", 500, 250, "Invocateur de Shenron"],
    ["konami", 1500, 500, "Légende Rétro"],
    ["crew", 900, 400, "Roi des Pirates"],
  ] satisfies [SecretQuestId, number, number, string | undefined][])(
    "crédite une seule fois %s",
    (id, zen, xp, title) => {
      unlockSecret(id);
      const reward = SECRET_QUESTS.find((quest) => quest.id === id)!;
      expect("title" in reward ? reward.title : undefined).toBe(title);
      expect(getGuestBalance()).toBe(500 + zen);
      expect(getPlayerXp()).toBe(xp);
      expect(getSecretQuests().claimed).toEqual([id]);
      unlockSecret(id);
      expect(getGuestBalance()).toBe(500 + zen);
      expect(getPlayerXp()).toBe(xp);
    },
  );

  it("ne débloque ni ne crédite si l'écriture échoue", () => {
    const listener = vi.fn();
    window.addEventListener("zenkai:secret-unlocked", listener);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "zenkai_guest_collection") throw new Error("storage full");
      return original.call(this, key, value);
    });
    expect(() => unlockSecret("konami")).toThrow("storage full");
    expect(getSecretQuests().unlocked).toEqual([]);
    expect(getSecretQuests().claimed).toEqual([]);
    expect(getPlayerXp()).toBe(0);
    expect(getGuestBalance()).toBe(500);
    expect(listener).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    unlockSecret("konami");
    expect(getSecretQuests().claimed).toEqual(["konami"]);
    window.removeEventListener("zenkai:secret-unlocked", listener);
  });

  it("crédite une fois les anciens cadeaux en attente sans modifier les succès déjà réclamés", () => {
    updateGuestState((state) => ({
      state: {
        ...state,
        secrets: {
          unlocked: ["word", "night", "konami"],
          claimed: ["konami"],
          recycled: 3,
          clickerResetDone: true,
        },
      },
      result: undefined,
    }));
    creditPendingSecrets();
    expect(getSecretQuests()).toMatchObject({
      unlocked: ["word", "night", "konami"],
      claimed: ["konami", "word", "night"],
      recycled: 3,
      clickerResetDone: true,
    });
    expect(getGuestBalance()).toBe(1700);
    expect(getPlayerXp()).toBe(600);
    creditPendingSecrets();
    expect(getGuestBalance()).toBe(1700);
    expect(getPlayerXp()).toBe(600);
  });

  it("préserve les anciens cadeaux en attente si le stockage échoue", () => {
    updateGuestState((state) => ({
      state: { ...state, secrets: { ...readSecretQuests(state.secrets), unlocked: ["clicker"] } },
      result: undefined,
    }));
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "zenkai_guest_collection") throw new Error("storage full");
      return original.call(this, key, value);
    });
    expect(() => creditPendingSecrets()).toThrow("storage full");
    expect(getSecretQuests().unlocked).toContain("clicker");
    expect(getSecretQuests().claimed).toEqual([]);
    expect(getPlayerXp()).toBe(0);
    expect(getGuestBalance()).toBe(500);
    vi.restoreAllMocks();
    creditPendingSecrets();
    expect(getSecretQuests().claimed).toContain("clicker");
    expect(getGuestState().zen).toBe(1000);
  });
});
