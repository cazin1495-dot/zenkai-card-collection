import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RefreshCw, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { cardsQuery, profileQuery } from "@/lib/queries";
import { useZenkaiPlus } from "@/hooks/use-zenkai-plus";
import { plusAvatarImage } from "@/lib/subscription";
import { PlusAvatar, PlusBadge } from "@/components/ZenkaiPlus";
import { acceptFriendRequest, friendshipsKey, friendshipsQuery, removeFriendship, sendFriendRequest, splitFriendships, type Friendship } from "@/lib/friendships";

export const Route = createFileRoute("/friends")({
  head: () => ({ meta: [
    { title: "Amis — ZENKAI" },
    { name: "description", content: "Ajoute des joueurs, accepte tes demandes d’amis et retrouve ta communauté ZENKAI." },
    { property: "og:title", content: "Amis — ZENKAI" },
    { property: "og:description", content: "Tes amis et demandes reçues ou envoyées sur ZENKAI." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: FriendsPage,
});

export function FriendsPage() {
  const { session, guest } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const profile = useQuery({ ...profileQuery(userId), enabled: !!session });
  const cards = useQuery(cardsQuery);
  const plus = useZenkaiPlus();
  const friendships = useQuery({ ...friendshipsQuery(userId), enabled: !!session, refetchInterval: 15_000 });
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const lists = splitFriendships(friendships.data ?? [], userId);
  async function refresh() { await queryClient.invalidateQueries({ queryKey: friendshipsKey(userId) }); }
  async function send() {
    if (!session || pending || !username.trim()) return;
    setPending("send");
    try { const player = await sendFriendRequest(userId, username); setUsername(""); await refresh(); toast.success(`Demande envoyée à ${player.username}.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Impossible d’envoyer la demande."); }
    finally { setPending(null); }
  }
  async function act(row: Friendship, action: "accept" | "refuse" | "cancel" | "remove") {
    if (!session || pending) return;
    setPending(row.id);
    try {
      if (action === "accept") await acceptFriendRequest(row.id, userId);
      else await removeFriendship(row.id);
      await refresh();
      toast.success(action === "accept" ? "Demande acceptée. Votre amitié est enregistrée." : action === "refuse" ? "Demande refusée." : action === "cancel" ? "Demande annulée." : "Ami retiré.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Action impossible. Réessaie."); await refresh(); }
    finally { setPending(null); }
  }
  function name(row: Friendship) { return row.requester_id === userId ? row.addressee_username : row.requester_username; }
  return <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
    <p className="game-eyebrow"><Users className="size-4" /> COMMUNAUTÉ ZENKAI</p>
    <div className="mt-3 flex items-center justify-between gap-3"><h1 className="text-3xl font-black sm:text-4xl">Amis</h1>{session && <Button variant="ghost" size="icon" aria-label="Actualiser les amis" title="Actualiser les amis" onClick={refresh} disabled={!!pending || friendships.isFetching}><RefreshCw className="size-4" /></Button>}</div>
    {(session || guest) && plus.state?.active && !plus.error && <div className="mt-6 flex items-center gap-3 rounded-md border border-primary/30 bg-surface p-4"><PlusAvatar image={plusAvatarImage(plus.state.avatar, cards.data ?? [])} name="Ton avatar" active /><span className="font-bold">{guest ? "Invité local" : profile.data?.username ?? "Joueur"}</span><PlusBadge /></div>}
    {!session ? <div className="mt-8 border-t border-border pt-6"><p className="text-sm text-muted-foreground">Connecte-toi pour envoyer et recevoir des demandes d’amis.</p><Button variant="hero" className="mt-4" asChild><Link to="/auth">Connexion</Link></Button></div> : <>
      <form onSubmit={event => { event.preventDefault(); void send(); }} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="friend-search" className="sr-only">Rechercher un joueur par pseudo</label>
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent" /><Input id="friend-search" placeholder="Pseudo du joueur…" value={username} maxLength={100} onChange={event => setUsername(event.target.value)} className="border-border bg-surface pl-10" disabled={pending === "send"} /></div>
        <Button type="submit" variant="hero" disabled={!!pending || !username.trim()}><UserPlus className="size-4" />{pending === "send" ? "Envoi…" : "Envoyer une demande"}</Button>
      </form>
      {friendships.isError && <div role="alert" className="mt-5 flex items-center gap-3 text-sm text-destructive">Impossible de charger les demandes d’amis.<Button variant="glass" size="sm" onClick={refresh}>Réessayer</Button></div>}
      {friendships.isLoading && <p role="status" className="mt-5 text-sm text-muted-foreground">Chargement des amis…</p>}
      <section aria-label="Demandes reçues" className="mt-8 border-t border-border pt-6">
        <h2 className="text-xl font-bold">Demandes reçues ({lists.received.length})</h2>
        {!friendships.isLoading && !friendships.isError && !lists.received.length && <p className="mt-4 text-sm text-muted-foreground">Aucune demande reçue.</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{lists.received.map(row => <article key={row.id} className="rounded-md border border-border bg-surface p-4"><PlayerName username={name(row)} /><div className="mt-4 flex flex-wrap gap-2"><Button variant="hero" size="sm" disabled={!!pending} onClick={() => act(row, "accept")} aria-label={`Accepter ${name(row)}`}><Check className="size-4" />Accepter</Button><Button variant="glass" size="sm" disabled={!!pending} onClick={() => act(row, "refuse")} aria-label={`Refuser ${name(row)}`}><X className="size-4" />Refuser</Button></div></article>)}</div>
      </section>
      <section aria-label="Mes amis" className="mt-8 border-t border-border pt-6"><h2 className="text-xl font-bold">Mes amis ({lists.accepted.length})</h2>{!friendships.isLoading && !friendships.isError && !lists.accepted.length && <p className="mt-4 text-sm text-muted-foreground">Tu n’as pas encore d’amis.</p>}<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{lists.accepted.map(row => <article key={row.id} className="rounded-md border border-border bg-surface p-4"><div className="flex items-center gap-2"><PlayerName username={name(row)} /><Button variant="ghost" size="icon" aria-label={`Retirer ${name(row)}`} title={`Retirer ${name(row)}`} disabled={!!pending} onClick={() => { if (window.confirm(`Retirer ${name(row)} de tes amis ?`)) void act(row, "remove"); }}><UserMinus className="size-4" /></Button></div><Button variant="glass" className="mt-4" asChild><Link to="/echanges" search={{ pseudo: name(row) }}>Échanger</Link></Button></article>)}</div></section>
      <section aria-label="Demandes envoyées" className="mt-8 border-t border-border pt-6"><h2 className="text-xl font-bold">Demandes envoyées ({lists.sent.length})</h2>{!friendships.isLoading && !friendships.isError && !lists.sent.length && <p className="mt-4 text-sm text-muted-foreground">Aucune demande en attente.</p>}<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{lists.sent.map(row => <article key={row.id} className="rounded-md border border-border bg-surface p-4"><PlayerName username={name(row)} /><div className="mt-4 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">En attente</span><Button variant="glass" size="sm" disabled={!!pending} onClick={() => act(row, "cancel")} aria-label={`Annuler la demande à ${name(row)}`}><X className="size-4" />Annuler</Button></div></article>)}</div></section>
    </>}
  </div>;
}

function PlayerName({ username }: { username: string }) { return <div className="flex min-w-0 flex-1 items-center gap-3"><span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-lg font-black text-primary">{username.trim().charAt(0).toUpperCase() || "?"}</span><p className="min-w-0 break-words font-bold">{username}</p></div>; }