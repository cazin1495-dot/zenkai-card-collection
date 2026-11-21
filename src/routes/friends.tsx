import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cardsQuery, profileQuery } from "@/lib/queries";
import { useZenkaiPlus } from "@/hooks/use-zenkai-plus";
import { plusAvatarImage } from "@/lib/subscription";
import { PlusAvatar, PlusBadge } from "@/components/ZenkaiPlus";
import {
  addLocalFriend,
  getLocalFriends,
  localFriendsKey,
  removeLocalFriend,
} from "@/lib/local-friends";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Amis — Zenkai" },
      { name: "description", content: "Retrouve les joueurs de Zenkai." },
    ],
  }),
  component: FriendsPage,
});

export function FriendsPage() {
  const { session, guest } = useAuth();
  const userId = session?.user.id ?? "local-guest";
  const queryClient = useQueryClient();
  const profile = useQuery({ ...profileQuery(userId), enabled: !!session });
  const cards = useQuery(cardsQuery);
  const plus = useZenkaiPlus();
  const friends = useQuery({
    queryKey: ["local-friends", userId],
    queryFn: () => getLocalFriends(userId),
    enabled: !!userId,
  });
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === localFriendsKey(userId)) {
        void queryClient.invalidateQueries({ queryKey: ["local-friends", userId] });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient, userId]);

  async function addVerifiedFriend() {
    const name = username.trim();
    if (!session || pending || !name) return;
    setPending(true);
    try {
      const pattern = name.replace(/[\\%_]/g, "\\$&");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username")
        .ilike("username", pattern)
        .neq("id", userId)
        .limit(2);
      if (error) throw new Error(error.message);
      if (!data.length) {
        toast.error(
          "Aucun joueur trouvé avec ce pseudo. La recherche dépend des profils accessibles.",
        );
        return;
      }
      if (data.length > 1) {
        toast.error("Plusieurs joueurs portent ce pseudo. Impossible de les distinguer.");
        return;
      }
      const player = data[0]!;
      await queryClient.cancelQueries({ queryKey: ["local-friends", userId] });
      const updated = addLocalFriend(userId, player);
      queryClient.setQueryData(["local-friends", userId], updated);
      setUsername("");
      toast.success(`${player.username} ajouté à ta liste locale`);
    } catch (error) {
      toast.error(
        `Ajout impossible : ${error instanceof Error ? error.message : "erreur inconnue"}`,
      );
    } finally {
      setPending(false);
    }
  }

  async function removeFriend(id: string) {
    try {
      await queryClient.cancelQueries({ queryKey: ["local-friends", userId] });
      const updated = removeLocalFriend(userId, id);
      queryClient.setQueryData(["local-friends", userId], updated);
      toast.success("Joueur retiré de ta liste locale.");
    } catch (error) {
      toast.error(
        `Suppression impossible : ${error instanceof Error ? error.message : "erreur inconnue"}`,
      );
    }
  }

  async function addLocalNickname() {
    const name = username.trim();
    if (!name || pending) return;
    if (profile.data?.username && name.toLocaleLowerCase() === profile.data.username.trim().toLocaleLowerCase()) {
      toast.error("Tu ne peux pas t'ajouter toi-même.");
      return;
    }
    setPending(true);
    try {
      await queryClient.cancelQueries({ queryKey: ["local-friends", userId] });
      const updated = addLocalFriend(userId, {
        id: `pseudo:${encodeURIComponent(name.toLocaleLowerCase())}`,
        username: name,
      });
      queryClient.setQueryData(["local-friends", userId], updated);
      setUsername("");
      toast.success(`${name} ajouté à ta liste locale (pseudo non vérifié)`);
    } catch (error) {
      toast.error(
        `Ajout impossible : ${error instanceof Error ? error.message : "erreur inconnue"}`,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <p className="game-eyebrow">
        <Users className="size-4" /> COMMUNAUTÉ ZENKAI
      </p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">Amis</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cette liste est enregistrée uniquement sur cet appareil. Elle n’envoie pas de demande et
        n’est pas synchronisée.
      </p>
      {(session || guest) && plus.state?.active && !plus.error && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-primary/30 bg-surface p-4">
          <PlusAvatar
            image={plusAvatarImage(plus.state.avatar, cards.data ?? [])}
            name="Ton avatar"
            active
          />
          <span className="font-bold">{guest ? "Invité local" : profile.data?.username ?? "Joueur"}</span>
          <PlusBadge />
          <span className="text-xs text-muted-foreground">Profil local uniquement</span>
        </div>
      )}
      <>
          <form onSubmit={(event) => { event.preventDefault(); void addLocalNickname(); }} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="friend-search" className="sr-only">
              Rechercher un joueur par pseudo
            </label>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent" />
              <Input
                id="friend-search"
                placeholder="Ajouter un ami par pseudo..."
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="border-border bg-surface pl-10"
              />
            </div>
            <Button type="submit" variant="hero" disabled={pending || !username.trim()}>
              <UserPlus className="size-4" /> {pending ? "Ajout…" : "Ajouter"}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Le pseudo ajouté est local et non vérifié ; aucun joueur ne sera notifié.
          </p>
          {session && <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="glass"
              disabled={pending || !username.trim()}
              onClick={addVerifiedFriend}
            >
              Rechercher et ajouter un profil vérifié
            </Button>
            <span className="text-xs text-muted-foreground">
              Recherche facultative limitée aux profils accessibles sur le serveur.
            </span>
          </div>}
          <section className="mt-10">
            <h2 className="text-xl font-bold">Mes amis ({friends.data?.length ?? "…"})</h2>
            {friends.isError && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                Liste locale indisponible : vérifie le stockage de ton navigateur.
              </p>
            )}
            {friends.data?.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">Ta liste locale est vide.</p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {friends.data?.map((friend) => (
                <article
                  key={friend.id}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="grid size-12 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-lg font-black text-primary"
                    >
                      {friend.username.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{friend.username}</p>
                      <p className="text-xs text-muted-foreground">
                        Contact local
                        {friend.id.startsWith("pseudo:") ? " · pseudo non vérifié" : ""} · statut
                        indisponible
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Retirer ${friend.username}`}
                      onClick={() => removeFriend(friend.id)}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Collection et échanges entre joueurs indisponibles pour le moment.
                  </p>
                  <Button variant="glass" className="mt-3" asChild>
                    <Link to="/echanges" search={{ pseudo: friend.username }}>Échanger</Link>
                  </Button>
                </article>
              ))}
            </div>
          </section>
          <section className="mt-10 border-t border-border pt-6">
            <h2 className="text-lg font-bold">Demandes reçues / envoyées</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Les demandes d’amis ne sont pas encore disponibles.
            </p>
          </section>
      </>
    </div>
  );
}
