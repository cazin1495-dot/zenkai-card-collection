import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
  requester_username: string;
  addressee_username: string;
};

export const friendshipsKey = (userId: string) => ["friendships", userId] as const;
export const friendshipsQuery = (userId: string) => queryOptions({
  queryKey: friendshipsKey(userId),
  queryFn: async (): Promise<Friendship[]> => {
    const { data, error } = await supabase.rpc("list_friendships");
    if (error) throw error;
    return (data ?? []).filter((row): row is Friendship => row.status === "pending" || row.status === "accepted");
  },
  staleTime: 5_000,
});

export function splitFriendships(rows: Friendship[], userId: string) {
  const own = rows.filter(row => row.requester_id === userId || row.addressee_id === userId);
  return {
    received: own.filter(row => row.status === "pending" && row.addressee_id === userId),
    sent: own.filter(row => row.status === "pending" && row.requester_id === userId),
    accepted: own.filter(row => row.status === "accepted"),
  };
}

export async function sendFriendRequest(userId: string, username: string) {
  const { data, error } = await supabase.rpc("find_friend_player", { _username: username.trim() });
  if (error) throw error;
  if (!data?.length) throw new Error("Aucun joueur trouvé avec ce pseudo.");
  if (data.length > 1) throw new Error("Plusieurs joueurs portent ce pseudo. Demande un pseudo unique à ton ami.");
  const player = data[0];
  if (!player) throw new Error("Joueur introuvable.");
  if (player.id === userId) throw new Error("Tu ne peux pas t’ajouter toi-même.");
  const result = await supabase.from("friendships").insert({ requester_id: userId, addressee_id: player.id, status: "pending" });
  if (result.error) {
    if (result.error.code === "23505") throw new Error("Une demande ou une amitié existe déjà avec ce joueur. Vérifie les demandes reçues.");
    throw result.error;
  }
  return player;
}

export async function acceptFriendRequest(id: string, userId: string) {
  const { data, error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id).eq("addressee_id", userId).eq("status", "pending").select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Cette demande n’est plus disponible.");
}

export async function removeFriendship(id: string) {
  const { data, error } = await supabase.from("friendships").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Cette demande ou amitié n’est plus disponible.");
}