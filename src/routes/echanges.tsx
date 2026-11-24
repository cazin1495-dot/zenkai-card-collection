import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Check, Coins, Send, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cardsQuery } from "@/lib/queries";
import { gameQuery } from "@/lib/game";
import type { Card } from "@/lib/cards";
export const Route = createFileRoute("/echanges")({ component: EchangesPage });
function EchangesPage() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const qc = useQueryClient();
  const { data: catalog = [] } = useQuery(cardsQuery);
  const { data: gameState } = useQuery({ ...gameQuery(userId ?? ""), enabled: !!userId });
  const cardById = useMemo(() => new Map(catalog.map((c: Card) => [c.id, c])), [catalog]);
  const { data: friendships = [] } = useQuery({ queryKey: ["friendships", userId], enabled: !!userId, queryFn: async () => (await (supabase as any).rpc("list_friendships")).data ?? [] });
  const friends = useMemo(() => !userId ? [] : friendships.filter((f: any) => f.status === "accepted").map((f: any) => f.requester_id === userId ? { id: f.addressee_id, username: f.addressee_username } : { id: f.requester_id, username: f.requester_username }), [friendships, userId]);
  const [friendId, setFriendId] = useState("");
  const activeFriendId = friendId || friends?.id || "";
  const { data: myCopies = [], refetch: refetchMy } = useQuery({ queryKey: ["my-trade-copies", userId], enabled: !!userId, queryFn: async () => (await (supabase as any).from("user_cards").select("id,card_id,transcended").eq("user_id", userId)).data ?? [] });
  const { data: friendCopies = [], refetch: refetchFriend } = useQuery({ queryKey: ["friend-trade-copies", activeFriendId], enabled: !!userId && !!activeFriendId, queryFn: async () => (await (supabase as any).rpc("list_friend_user_cards", { _friend_id: activeFriendId })).data ?? [] });
  const { data: offers = [], refetch: refetchOffers } = useQuery({ queryKey: ["trade-offers", userId], enabled: !!userId, refetchInterval: 8000, queryFn: async () => (await (supabase as any).rpc("list_trade_offers")).data ?? [] });
  const [selMy, setSelMy] = useState<string[]>([]);
  const [selFriend, setSelFriend] = useState<string[]>([]);
  const [offZen, setOffZen] = useState("0");
  const [reqZen, setReqZen] = useState("0");
  const [busy, setBusy] = useState(false);
  const toggle = (a: string[], id: string, fn: (v: string[]) => void) => fn(a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  const sendOffer = async () => {
    const oZ = Math.max(0, Math.floor(Number(offZen) || 0)), rZ = Math.max(0, Math.floor(Number(reqZen) || 0));
    if (!activeFriendId || (!selMy.length && !selFriend.length && !oZ && !rZ)) { toast.error("Choisis au moins une carte ou des Zen."); return; }
    setBusy(true);
    try { const { error } = await (supabase as any).rpc("create_trade_offer", { _receiver_id: activeFriendId, _offered_copy_ids: selMy, _requested_copy_ids: selFriend, _offered_coins: oZ, _requested_coins: rZ }); if (error) throw error; toast.success("Proposition envoyée !"); setSelMy([]); setSelFriend([]); setOffZen("0"); setReqZen("0"); await refetchOffers(); } catch (e: any) { toast.error(e?.message || "Erreur."); } finally { setBusy(false); }
  };
  const acceptOffer = async (id: string) => { setBusy(true); try { const { error } = await (supabase as any).rpc("accept_trade_offer", { _offer_id: id }); if (error) throw error; toast.success("Échange accepté ! Cartes et Zen transférés immédiatement."); await Promise.all([qc.invalidateQueries({ queryKey: ["game"] }), qc.invalidateQueries({ queryKey: ["user-cards"] }), qc.invalidateQueries({ queryKey: ["collection"] }), refetchMy(), refetchFriend(), refetchOffers()]); } catch (e: any) { toast.error(e?.message || "Erreur."); } finally { setBusy(false); } };
  const cancelOffer = async (id: string) => { setBusy(true); try { await (supabase as any).rpc("decline_or_cancel_trade_offer", { _offer_id: id }); await refetchOffers(); } finally { setBusy(false); } };
  if (!userId) return <div className="mx-auto max-w-xl py-16 text-center"><h1 className="text-2xl font-bold">Échanges Cartes &amp; Zen</h1><p className="mt-2 text-muted-foreground">Connecte-toi pour échanger avec tes amis.</p><Button asChild className="mt-4"><Link to="/auth">Se connecter</Link></Button></div>;
  return (<div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="flex items-center gap-2 text-2xl font-bold"><ArrowLeftRight className="size-6 text-primary" /> Échanges Cartes &amp; Zen</h1><span className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold"><Coins className="size-4 text-amber-400" /> {(gameState?.coins ?? 0).toLocaleString("fr-FR")} Zen</span></div>
    {offers.length > 0 && <div className="grid gap-3 md:grid-cols-2">{offers.map((o: any) => { const inc = o.receiver_id === userId; return (<div key={o.id} className="space-y-2 rounded-lg border bg-card p-4 text-xs"><div className="flex justify-between font-semibold"><span>{inc ? `De ${o.sender_username}` : `À ${o.receiver_username}`}</span><span className="uppercase text-primary">{o.status === "accepted" ? "Transféré ✓" : o.status}</span></div><div className="grid grid-cols-2 gap-2"><div><p className="font-semibold text-primary">{inc ? `${o.sender_username} donne :` : "Tu donnes :"}</p>{o.offered_coins > 0 && <p className="font-bold text-amber-400">{o.offered_coins} Zen</p>}{(o.offered_cards ?? []).map((c: any) => <p key={c.id}>• {cardById.get(c.card_id)?.name ?? c.card_id}</p>)}</div><div><p className="font-semibold text-emerald-400">{inc ? "Tu donnes :" : `${o.receiver_username} donne :`}</p>{o.requested_coins > 0 && <p className="font-bold text-amber-400">{o.requested_coins} Zen</p>}{(o.requested_cards ?? []).map((c: any) => <p key={c.id}>• {cardById.get(c.card_id)?.name ?? c.card_id}</p>)}</div></div>{o.status === "pending" && <div className="flex justify-end gap-2">{inc ? <><Button size="sm" variant="outline" disabled={busy} onClick={() => cancelOffer(o.id)}><X className="size-3.5" /> Refuser</Button><Button size="sm" disabled={busy} onClick={() => acceptOffer(o.id)}><Check className="size-3.5" /> Accepter</Button></> : <Button size="sm" variant="outline" disabled={busy} onClick={() => cancelOffer(o.id)}>Annuler</Button>}</div>}</div>); })}</div>}
    {friends.length === 0 ? <div className="rounded-xl border bg-card p-8 text-center"><Users className="mx-auto size-8 text-muted-foreground" /><p className="mt-2 font-semibold">Ajoute un ami sur l’onglet Amis pour échanger !</p><Button asChild className="mt-3"><Link to="/friends">Aller sur Amis</Link></Button></div> : (<div className="space-y-4 rounded-xl border bg-card p-5"><div className="flex items-center gap-2"><span className="text-sm font-semibold">Ami :</span><select value={activeFriendId} onChange={(e) => { setFriendId(e.target.value); setSelFriend([]); }} className="rounded border bg-background px-3 py-1.5 text-sm">{friends.map((f: any) => <option key={f.id} value={f.id}>{f.username}</option>)}</select></div><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-2 rounded-lg border p-3"><p className="text-sm font-semibold text-primary">1. Ce que tu donnes ({selMy.length})</p><div className="flex items-center gap-2 text-xs"><Coins className="size-4 text-amber-400" /> Zen : <Input type="number" min={0} value={offZen} onChange={(e) => setOffZen(e.target.value)} className="h-8 w-28" /></div><div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto">{myCopies.map((it: any) => { const c = cardById.get(it.card_id); return <button type="button" key={it.id} onClick={() => toggle(selMy, it.id, setSelMy)} className={`flex items-center gap-2 rounded border p-1.5 text-left text-xs ${selMy.includes(it.id) ? "border-primary bg-primary/15" : ""}`}>{c?.image_url && <img src={c.image_url} className="size-8 rounded object-cover" />}<span className="truncate font-medium">{c?.name ?? it.card_id}</span></button>; })}</div></div><div className="space-y-2 rounded-lg border p-3"><p className="text-sm font-semibold text-emerald-400">2. Ce que tu demandes ({selFriend.length})</p><div className="flex items-center gap-2 text-xs"><Coins className="size-4 text-amber-400" /> Zen : <Input type="number" min={0} value={reqZen} onChange={(e) => setReqZen(e.target.value)} className="h-8 w-28" /></div><div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto">{friendCopies.map((it: any) => { const c = cardById.get(it.card_id); return <button type="button" key={it.id} onClick={() => toggle(selFriend, it.id, setSelFriend)} className={`flex items-center gap-2 rounded border p-1.5 text-left text-xs ${selFriend.includes(it.id) ? "border-emerald-400 bg-emerald-500/15" : ""}`}>{c?.image_url && <img src={c.image_url} className="size-8 rounded object-cover" />}<span className="truncate font-medium">{c?.name ?? it.card_id}</span></button>; })}</div></div></div><Button disabled={busy} onClick={sendOffer} className="rounded-full"><Send className="mr-1.5 size-4" /> Envoyer la proposition</Button></div>)}
  </div>);
}
