import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AnimeCard } from "@/components/AnimeCard";
import { LocalLevel } from "@/components/LocalLevel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useLevel } from "@/hooks/use-level";
import { useQuests } from "@/hooks/use-quests";
import { useSecretQuests } from "@/hooks/use-secret-quests";
import { usePlayerProfileUsername } from "@/hooks/use-player-profile-username";
import { supabase } from "@/integrations/supabase/client";
import { getGuestCollection } from "@/lib/guest-collection";
import { betaEnded, hasBetaWelcome, resetGuestBetaProgress } from "@/lib/beta";
import { cardsQuery } from "@/lib/queries";
import { CUSTOM_TRANSCENDANCE_CARDS, customTranscendanceAsCard } from "@/lib/transcendance-cards";
import {
  completedAlbumCount,
  claimPlayerUsername,
  getPlayerProfile,
  PLAYER_PROFILE_UPDATED,
  playerUsernameKey,
  PROFILE_FRAMES,
  profileCards,
  profilePortrait,
  profileRarityRank,
  profileTitles,
  savePlayerProfile,
  unlockedProfileFrames,
  validatePlayerProfile,
  type PlayerProfile,
  type ProfileCopy,
} from "@/lib/player-profile";

const BANNERS = [
  { id: "solar", name: "Or Solaire", className: "from-amber-700/70 via-violet-950 to-slate-950" },
  {
    id: "imperial",
    name: "Violet Impérial",
    className: "from-violet-800/80 via-fuchsia-950 to-slate-950",
  },
  {
    id: "cosmic",
    name: "Crépuscule cosmique",
    className: "from-indigo-950 via-purple-800/70 to-amber-800/60",
  },
] as const;

export function PlayerProfileDialog({ trigger }: { trigger?: ReactElement } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="glass" size="sm" className="shrink-0">
          <UserRound className="size-4" /> Profil
        </Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[96vw] max-w-5xl overflow-y-auto border-amber-400/30 bg-slate-950 p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>Profil du joueur</DialogTitle>
          <DialogDescription>
            Personnalisation locale sur cet appareil ; le pseudo définitif est partagé en ligne.
          </DialogDescription>
        </DialogHeader>
        {open && <PlayerProfileContent onSaved={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PlayerProfileContent({ onSaved }: { onSaved: () => void }) {
  const { session, ready } = useAuth();
  const userId = session?.user.id ?? null;
  const usernameStatus = usePlayerProfileUsername();
  const client = useQueryClient();
  const catalog = useQuery(cardsQuery);
  const local = useQuery({
    queryKey: ["guest-collection"],
    queryFn: getGuestCollection,
    enabled: ready,
  });
  const copies: readonly ProfileCopy[] | undefined = local.data;
  const quests = useQuests(userId);
  const secrets = useSecretQuests();
  const level = useLevel();
  const [draft, setDraft] = useState<PlayerProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [selector, setSelector] = useState<"avatar" | number | null>(null);
  const [search, setSearch] = useState("");
  const [betaWelcome, setBetaWelcome] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newUsername, setNewUsername] = useState("");

  useEffect(() => { setNewUsername(""); }, [userId]);

  useEffect(() => {
    const refresh = () => {
      try {
        setDraft(getPlayerProfile());
        setBetaWelcome(hasBetaWelcome());
        setProfileError(false);
      } catch {
        setDraft(null);
        setProfileError(true);
      }
    };
    refresh();
    window.addEventListener(PLAYER_PROFILE_UPDATED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PLAYER_PROFILE_UPDATED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ["guest-collection"] });
    };
    window.addEventListener("zenkai:guest-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("zenkai:guest-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [client]);

  const allCards = useMemo(
    () => [
      ...(catalog.data ?? []),
      ...CUSTOM_TRANSCENDANCE_CARDS.map(customTranscendanceAsCard),
    ],
    [catalog.data],
  );
  const owned = useMemo(() => profileCards(allCards, copies ?? []), [allCards, copies]);
  const albumCards = useMemo(
    () => [
      ...new Map(
        [...(catalog.data ?? []), ...CUSTOM_TRANSCENDANCE_CARDS.map(customTranscendanceAsCard)].map(
          (card) => [card.id, card],
        ),
      ).values(),
    ],
    [catalog.data],
  );
  const byId = useMemo(() => new Map(owned.map((item) => [item.card.id, item])), [owned]);
  const ownedIds = useMemo(() => new Set((copies ?? []).map((copy) => copy.card_id)), [copies]);
  const unlockedAvatarCards = useMemo(
    () =>
      allCards
        .filter((card) => card.rarity === "legendaire" || ownedIds.has(card.id))
        .sort((a, b) => {
          const rank = (r: string) => (r === "transcendance" ? 3 : r === "mythique" ? 2 : r === "legendaire" ? 1 : 0);
          return rank(b.rarity) - rank(a.rarity) || (b.popularity ?? 0) - (a.popularity ?? 0);
        }),
    [allCards, ownedIds],
  );
  const lockedMythicCards = useMemo(
    () =>
      allCards
        .filter((card) => card.rarity === "mythique" && !ownedIds.has(card.id))
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
    [allCards, ownedIds],
  );
  const avatarById = useMemo(
    () =>
      new Map(
        unlockedAvatarCards.map((card) => [
          card.id,
          byId.get(card.id) ?? {
            card,
            copy: { card_id: card.id, transcended: false },
          },
        ]),
      ),
    [unlockedAvatarCards, byId],
  );
  const avatarIds = useMemo(() => new Set(unlockedAvatarCards.map((card) => card.id)), [unlockedAvatarCards]);
  const frameOptions = unlockedProfileFrames(level.level ?? 1, owned, copies ?? []);
  const series = [
    ...new Set(albumCards.flatMap((card) => (card.series?.trim() ? [card.series.trim()] : []))),
  ];
  const titles =
    quests.state && secrets.state && level.level !== null
      ? profileTitles(level.level, quests.state.albums, secrets.state, series, betaWelcome)
      : [];
  const allowedTitles = new Set(
    titles.filter((title) => title.unlocked).map((title) => title.name),
  );
  const dataError =
    catalog.isError ||
    local.isError ||
    quests.error ||
    secrets.error ||
    level.error;
  const loading =
    !ready || !catalog.data || !copies || !quests.state || !secrets.state || level.level === null;

  function choose(id: string) {
    if (!draft || selector === null) return;
    if (selector === "avatar") setDraft({ ...draft, avatarCardId: id });
    else {
      const slots: PlayerProfile["showcaseCardIds"] = [...draft.showcaseCardIds];
      slots[selector] = id;
      setDraft({ ...draft, showcaseCardIds: slots });
    }
    setSelector(null);
  }
  function clearSlot(index: number) {
    if (!draft) return;
    const slots: PlayerProfile["showcaseCardIds"] = [...draft.showcaseCardIds];
    slots[index] = null;
    setDraft({ ...draft, showcaseCardIds: slots });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || loading || dataError || saving || (userId && (usernameStatus.isLoading || usernameStatus.isError))) return;
    setSaving(true);
    let claimed = false;
    try {
      const username = userId ? usernameStatus.username ?? newUsername.trim() : draft.username;
      const next = userId
        ? { ...draft, username, lockedUsername: { userId, username } }
        : draft;
      const allowed = { ownedIds, avatarIds, frames: frameOptions, titles: allowedTitles };
      validatePlayerProfile(next, allowed);
      if (userId && !usernameStatus.serverUsername) {
        try {
          await claimPlayerUsername(userId, username);
        } catch (error) {
          await usernameStatus.refetch();
          throw error;
        }
        claimed = true;
        client.setQueryData(playerUsernameKey(userId), username);
      }
      let authError: string | null = null;
      if (session && claimed) {
        try {
          const { error } = await supabase.auth.updateUser({ data: { username } });
          if (error) authError = error.message;
        } catch (reason) {
          authError = reason instanceof Error ? reason.message : "Erreur de connexion.";
        }
      }
      savePlayerProfile(next, allowed);
      if (authError) {
        toast.error(`Pseudo définitif enregistré, mais synchronisation du compte impossible : ${authError}`);
        onSaved();
        return;
      }
      toast.success("Profil local enregistré.");
      onSaved();
    } catch (reason) {
      toast.error(
        claimed
          ? `Pseudo définitif réservé, mais profil local non enregistré : ${reason instanceof Error ? reason.message : "Erreur de stockage."}`
          : reason instanceof Error ? reason.message : "Enregistrement du profil impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetProgress() {
    if (userId) return;
    if (!window.confirm("Es-tu sûr de vouloir remettre tes cartes, tes Zen et ton niveau à zéro pour tester la Bêta depuis le début ? La progression locale partagée sur cet appareil sera aussi supprimée.")) return;
    try {
      resetGuestBetaProgress();
      window.location.reload();
    } catch (reason) {
      toast.error(reason instanceof Error ? `Réinitialisation locale impossible : ${reason.message}` : "Réinitialisation locale impossible.");
    }
  }

  if (profileError)
    return (
      <p role="alert" className="text-sm text-destructive">
        Profil local indisponible. Vérifie le stockage de cet appareil.
      </p>
    );
  if (dataError)
    return (
      <p role="alert" className="text-sm text-destructive">
        Collection ou progression indisponible. Vérifie le stockage et la connexion, puis réessaie.
      </p>
    );
  if (!draft || loading || !copies || !quests.state || !secrets.state || level.level === null)
    return <p className="text-sm text-muted-foreground">Chargement du profil…</p>;

  const avatar = (draft.avatarCardId ? avatarById.get(draft.avatarCardId) : undefined) ?? owned[0];
  const portrait = avatar ? profilePortrait(avatar) : null;
  const frame = frameOptions.has(draft.avatarFrame) ? draft.avatarFrame : "steel";
  const missingAvatar = draft.avatarCardId !== null && !avatarById.has(draft.avatarCardId);
  const missingSlots = draft.showcaseCardIds.some((id) => id !== null && !byId.has(id));
  const missingCards = [...ownedIds].some((id) => !byId.has(id));
  const mythic = copies.filter((copy) => {
    const item = byId.get(copy.card_id);
    return (
      item &&
      !copy.transcended &&
      !copy.customTranscendance &&
      profileRarityRank({ card: item.card, copy }) === 1
    );
  }).length;
  const transcendance = copies.filter((copy) => {
    const item = byId.get(copy.card_id);
    return (
      copy.transcended ||
      copy.customTranscendance ||
      (item && profileRarityRank({ card: item.card, copy }) === 0)
    );
  }).length;
  const selectable = selector === "avatar" ? [...avatarById.values()] : owned;
  const filtered = selectable.filter((item) =>
    `${profilePortrait(item).name} ${item.card.series ?? ""}`
      .toLocaleLowerCase("fr")
      .includes(search.trim().toLocaleLowerCase("fr")),
  );
  const displayUsername = userId ? usernameStatus.username ?? "Choisir un pseudo" : draft.username;

  return (
    <form onSubmit={save} className="space-y-6">
      <section
        className={`rounded-2xl border border-amber-400/30 bg-gradient-to-br p-5 ${BANNERS.find((item) => item.id === draft.banner)?.className}`}
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
          <div
            className={`profile-frame profile-frame-${frame}`}
            aria-label={`Cadre ${PROFILE_FRAMES.find((item) => item.id === frame)?.name}`}
          >
            <div className="profile-frame-image">
              <AvatarPortrait
                key={portrait?.src ?? "initial"}
                portrait={portrait}
                username={displayUsername}
              />
            </div>
            {frame === "rainbow" && (
              <Sparkles aria-hidden className="profile-frame-sparkle size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-black text-amber-200">
              {displayUsername || "Joueur"}
            </p>
            <p className="mt-1 text-sm font-bold text-violet-200">
              {allowedTitles.has(draft.equippedTitle) ? draft.equippedTitle : "Titre indisponible"}
            </p>
            <p className="mt-2 text-sm text-white/75">
              {draft.bio || "Une nouvelle aventure commence."}
            </p>
            <p className="mt-2 text-xs text-white/60">
              Collection locale sur cet appareil
            </p>
          </div>
          <Button
            type="button"
            variant="glass"
            className="w-full sm:ml-auto sm:w-auto"
            onClick={() => {
              setSearch("");
              setSelector("avatar");
            }}
          >
            Changer d'avatar
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => setDraft({ ...draft, avatarCardId: null })}
        >
          Avatar automatique
        </Button>
        {missingAvatar && (
          <p role="alert" className="mt-2 text-xs text-amber-300">
            Cet avatar n'est plus dans le catalogue. Choisis un avatar disponible ou le mode
            automatique avant d'enregistrer.
          </p>
        )}
        {!frameOptions.has(draft.avatarFrame) && (
          <p role="alert" className="mt-2 text-xs text-amber-300">
            Le cadre enregistré n'est pas disponible pour cette collection. Choisis un cadre
            débloqué.
          </p>
        )}
      </section>

      <section className="grid gap-4 rounded-2xl border border-violet-400/20 bg-violet-950/20 p-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">
          Pseudo
          <Input
            aria-label="Pseudo"
            maxLength={30}
            required
            disabled={!!userId && (!!usernameStatus.username || usernameStatus.isLoading || usernameStatus.isError || saving)}
            value={userId ? usernameStatus.username ?? newUsername : draft.username}
            onChange={(event) => userId ? setNewUsername(event.target.value) : setDraft({ ...draft, username: event.target.value })}
          />
          {userId && (usernameStatus.username ? (
            <span className="block text-xs text-amber-300">🔒 Pseudo définitif</span>
          ) : !usernameStatus.isLoading && !usernameStatus.isError ? (
            <span className="block text-xs text-amber-300">Attention : ton pseudo est définitif et ne pourra plus être modifié après validation</span>
          ) : null)}
        </label>
        {userId && usernameStatus.isError && <p role="alert" className="text-sm text-destructive">Impossible de vérifier ton pseudo définitif. <button type="button" className="underline" onClick={() => { void usernameStatus.refetch(); }}>Réessayer</button></p>}
        <label className="space-y-2 text-sm font-semibold">
          Bio
          <Input
            aria-label="Bio"
            maxLength={160}
            value={draft.bio}
            onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
            placeholder="Chasseur de cartes Transcendance…"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Titre équipé
          <select
            aria-label="Titre équipé"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.equippedTitle}
            onChange={(event) => setDraft({ ...draft, equippedTitle: event.target.value })}
          >
            {!titles.some((title) => title.name === draft.equippedTitle) && (
              <option value={draft.equippedTitle} disabled>
                {draft.equippedTitle} · indisponible
              </option>
            )}
            {titles.map((title) => (
              <option key={title.name} value={title.name} disabled={!title.unlocked}>
                {title.name}
                {!title.unlocked ? ` · Verrouillé (${title.requirement})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold">
          Bannière
          <select
            aria-label="Bannière"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.banner}
            onChange={(event) => {
              const banner = BANNERS.find((item) => item.id === event.target.value);
              if (banner) setDraft({ ...draft, banner: banner.id });
            }}
          >
            {BANNERS.map((banner) => (
              <option key={banner.id} value={banner.id}>
                {banner.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-semibold">Cadre d'avatar</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PROFILE_FRAMES.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={draft.avatarFrame === item.id ? "hero" : "glass"}
                className="h-auto justify-start whitespace-normal text-left"
                aria-pressed={draft.avatarFrame === item.id}
                disabled={!frameOptions.has(item.id)}
                onClick={() => setDraft({ ...draft, avatarFrame: item.id })}
              >
                {!frameOptions.has(item.id) && <Lock className="size-3" />}
                <span>
                  {item.name}
                  <span className="block text-xs font-normal opacity-75">{item.requirement}</span>
                </span>
              </Button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-bold text-amber-200">
            Vitrine de Collection · Mes 8 Cartes Favorites
          </h3>
          <p className="text-xs text-muted-foreground">
            Choisis des cartes de ta collection active.
          </p>
        </div>
        {missingSlots && (
          <p role="alert" className="text-xs text-amber-300">
            Certaines cartes ne sont plus disponibles. Retire-les ou remplace-les avant
            d'enregistrer.
          </p>
        )}
        {missingCards && (
          <p role="alert" className="text-xs text-amber-300">
            Certaines cartes possédées manquent du catalogue chargé et ne peuvent pas être
            sélectionnées.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {draft.showcaseCardIds.map((id, index) => {
            const item = id ? byId.get(id) : undefined;
            return (
              <div key={index} className="min-w-0 space-y-2">
                {item ? (
                  <AnimeCard
                    card={item.card}
                    transcended={item.copy.transcended}
                    customTranscendance={item.copy.customTranscendance}
                  />
                ) : (
                  <div className="grid aspect-[2/3] place-items-center rounded-xl border border-dashed border-amber-400/30 bg-violet-950/20 p-3 text-center text-xs text-muted-foreground">
                    {id ? "Carte indisponible" : "Emplacement libre"}
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="glass"
                  className="h-auto min-h-11 w-full whitespace-normal px-1 text-center"
                  onClick={() => {
                    setSearch("");
                    setSelector(index);
                  }}
                >
                  Modifier emplacement {index + 1}
                </Button>
                {id && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    onClick={() => clearSlot(index)}
                  >
                    Retirer carte {index + 1}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-400/20 bg-violet-950/20 p-4">
        <h3 className="mb-3 font-bold text-amber-200">Statistiques du joueur</h3>
        <LocalLevel />
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <p>
            <strong>{ownedIds.size}</strong>
            <span className="block text-xs text-muted-foreground">Cartes uniques</span>
          </p>
          <p>
            <strong>{mythic}</strong>
            <span className="block text-xs text-muted-foreground">Copies Mythiques</span>
          </p>
          <p>
            <strong>{transcendance}</strong>
            <span className="block text-xs text-muted-foreground">Copies Transcendance</span>
          </p>
          <p>
            <strong>{completedAlbumCount(albumCards, ownedIds)}</strong>
            <span className="block text-xs text-muted-foreground">Albums complétés</span>
          </p>
        </div>
      </section>
      <div className="flex justify-end">
        <Button type="submit" variant="hero" disabled={saving || (!!userId && (usernameStatus.isLoading || usernameStatus.isError))}>
          {saving ? "Enregistrement…" : "Enregistrer le profil"}
        </Button>
      </div>
      <div className="text-center">
        <Button type="button" variant="ghost" size="sm" className="h-auto whitespace-normal text-muted-foreground" disabled={!!userId || betaEnded()} onClick={resetProgress}>
          Réinitialiser ma progression Bêta (repartir de 0)
        </Button>
        {userId && <p className="mt-1 text-xs text-muted-foreground">La réinitialisation des comptes connectés nécessite une prise en charge sécurisée côté serveur.</p>}
      </div>

      <Dialog
        open={selector !== null}
        onOpenChange={(open) => {
          if (!open) setSelector(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto border-amber-400/30 bg-slate-950">
          <DialogHeader>
            <DialogTitle>
              {selector === "avatar" ? "Choisir un avatar" : "Choisir une carte pour la vitrine"}
            </DialogTitle>
            <DialogDescription>
              {selector === "avatar"
                ? "Tous les personnages Légendaires populaires sont ouverts à tous. Droppe une carte Mythique en booster pour débloquer son avatar !"
                : "Choisis des cartes possédées dans ta collection."}
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Rechercher une carte ou série"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une carte ou une série…"
          />
          {selector === "avatar" && lockedMythicCards.length > 0 && (
            <p className="text-xs font-medium text-rose-300">
              {unlockedAvatarCards.length} avatars débloqués • {lockedMythicCards.length} avatars Mythiques à débloquer en booster
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((item) => {
              const image = profilePortrait(item);
              return (
                <button
                  key={item.card.id}
                  type="button"
                  onClick={() => choose(item.card.id)}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-950/30 p-2 text-left hover:border-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                  {image.src ? (
                    <img loading="lazy" decoding="async"
                      src={image.src}
                      alt=""
                      className="h-14 w-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="grid h-14 w-10 shrink-0 place-items-center rounded bg-white/10">
                      {image.name.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{image.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {item.card.series ?? "Série inconnue"}
                    </span>
                  </span>
                </button>
              );
            })}
            {selector === "avatar" &&
              lockedMythicCards
                .filter((card) =>
                  `${card.name} ${card.series ?? ""}`
                    .toLocaleLowerCase("fr")
                    .includes(search.trim().toLocaleLowerCase("fr")),
                )
                .map((card) => {
                  const image = profilePortrait({ card, copy: { card_id: card.id, transcended: false } });
                  return (
                    <div
                      key={`locked-${card.id}`}
                      title="Droppe cette carte Mythique pour débloquer son avatar"
                      className="flex min-w-0 cursor-not-allowed items-center gap-2 rounded-lg border border-rose-500/25 bg-rose-950/15 p-2 text-left opacity-55"
                    >
                      {image.src ? (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={image.src}
                          alt={card.name}
                          className="size-10 shrink-0 rounded-md object-cover grayscale"
                        />
                      ) : (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-rose-950/40 text-xs font-bold text-rose-200">
                          🔒
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-rose-100">{card.name}</span>
                        <span className="block truncate text-[11px] text-rose-300/80">🔒 Mythique • À dropper</span>
                      </span>
                    </div>
                  );
                })}
          </div>
          {!filtered.length && (
            <p className="text-sm text-muted-foreground">
              {owned.length
                ? "Aucune carte ne correspond à la recherche."
                : "Aucune carte possédée dans cette collection."}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}

function AvatarPortrait({
  portrait,
  username,
}: {
  portrait: { src: string | null | undefined; name: string } | null;
  username: string;
}) {
  const [failed, setFailed] = useState(false);
  return portrait?.src && !failed ? (
    <img loading="lazy" decoding="async" src={portrait.src} alt={`Avatar ${portrait.name}`} onError={() => setFailed(true)} />
  ) : (
    <span>{username.trim().charAt(0).toLocaleUpperCase("fr") || "J"}</span>
  );
}
