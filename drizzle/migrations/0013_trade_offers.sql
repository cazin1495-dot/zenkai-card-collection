CREATE TABLE IF NOT EXISTS public.trade_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  offered_copy_ids uuid[] NOT NULL DEFAULT '{}',
  requested_copy_ids uuid[] NOT NULL DEFAULT '{}',
  offered_coins integer NOT NULL DEFAULT 0 CHECK (offered_coins >= 0),
  requested_coins integer NOT NULL DEFAULT 0 CHECK (requested_coins >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.trade_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read trades" ON public.trade_offers;
CREATE POLICY "Participants read trades" ON public.trade_offers
  FOR SELECT TO authenticated
  USING (auth.uid() IN (sender_id, receiver_id));

CREATE OR REPLACE FUNCTION public.list_friend_user_cards(_friend_id uuid)
RETURNS TABLE(id uuid, card_id text, transcended boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = u AND addressee_id = _friend_id) OR (requester_id = _friend_id AND addressee_id = u))
  ) THEN
    RAISE EXCEPTION 'not_friends';
  END IF;
  RETURN QUERY SELECT uc.id, uc.card_id, uc.transcended FROM public.user_cards uc WHERE uc.user_id = _friend_id;
END $$;

CREATE OR REPLACE FUNCTION public.create_trade_offer(
  _receiver_id uuid,
  _offered_copy_ids uuid[],
  _requested_copy_ids uuid[],
  _offered_coins integer DEFAULT 0,
  _requested_coins integer DEFAULT 0
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u uuid := auth.uid();
  v_id uuid;
  v_coins integer;
  v_count integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF u = _receiver_id THEN RAISE EXCEPTION 'cannot_trade_self'; END IF;
  IF _offered_coins < 0 OR _requested_coins < 0 THEN RAISE EXCEPTION 'invalid_coins'; END IF;
  IF coalesce(array_length(_offered_copy_ids, 1), 0) = 0
     AND coalesce(array_length(_requested_copy_ids, 1), 0) = 0
     AND _offered_coins = 0 AND _requested_coins = 0 THEN
    RAISE EXCEPTION 'empty_trade';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = u AND addressee_id = _receiver_id) OR (requester_id = _receiver_id AND addressee_id = u))
  ) THEN
    RAISE EXCEPTION 'not_friends';
  END IF;
  SELECT coins INTO v_coins FROM public.profiles WHERE id = u;
  IF coalesce(v_coins, 0) < _offered_coins THEN RAISE EXCEPTION 'insufficient_zen'; END IF;
  IF coalesce(array_length(_offered_copy_ids, 1), 0) > 0 THEN
    SELECT count(*) INTO v_count FROM public.user_cards WHERE user_id = u AND id = ANY(_offered_copy_ids);
    IF v_count <> array_length(_offered_copy_ids, 1) THEN RAISE EXCEPTION 'missing_offered_cards'; END IF;
  END IF;
  IF coalesce(array_length(_requested_copy_ids, 1), 0) > 0 THEN
    SELECT count(*) INTO v_count FROM public.user_cards WHERE user_id = _receiver_id AND id = ANY(_requested_copy_ids);
    IF v_count <> array_length(_requested_copy_ids, 1) THEN RAISE EXCEPTION 'missing_requested_cards'; END IF;
  END IF;
  INSERT INTO public.trade_offers (sender_id, receiver_id, offered_copy_ids, requested_copy_ids, offered_coins, requested_coins)
  VALUES (u, _receiver_id, coalesce(_offered_copy_ids, '{}'), coalesce(_requested_copy_ids, '{}'), _offered_coins, _requested_coins)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.accept_trade_offer(_offer_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u uuid := auth.uid();
  t public.trade_offers%ROWTYPE;
  s_coins integer;
  r_coins integer;
  v_count integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO t FROM public.trade_offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'trade_not_found'; END IF;
  IF t.receiver_id <> u THEN RAISE EXCEPTION 'not_receiver'; END IF;
  IF t.status <> 'pending' THEN RAISE EXCEPTION 'trade_not_pending'; END IF;

  SELECT coins INTO s_coins FROM public.profiles WHERE id = t.sender_id FOR UPDATE;
  SELECT coins INTO r_coins FROM public.profiles WHERE id = t.receiver_id FOR UPDATE;
  IF coalesce(s_coins, 0) < t.offered_coins THEN RAISE EXCEPTION 'sender_insufficient_zen'; END IF;
  IF coalesce(r_coins, 0) < t.requested_coins THEN RAISE EXCEPTION 'receiver_insufficient_zen'; END IF;

  IF coalesce(array_length(t.offered_copy_ids, 1), 0) > 0 THEN
    SELECT count(*) INTO v_count FROM public.user_cards WHERE user_id = t.sender_id AND id = ANY(t.offered_copy_ids);
    IF v_count <> array_length(t.offered_copy_ids, 1) THEN RAISE EXCEPTION 'sender_missing_cards'; END IF;
  END IF;
  IF coalesce(array_length(t.requested_copy_ids, 1), 0) > 0 THEN
    SELECT count(*) INTO v_count FROM public.user_cards WHERE user_id = t.receiver_id AND id = ANY(t.requested_copy_ids);
    IF v_count <> array_length(t.requested_copy_ids, 1) THEN RAISE EXCEPTION 'receiver_missing_cards'; END IF;
  END IF;

  IF coalesce(array_length(t.offered_copy_ids, 1), 0) > 0 THEN
    UPDATE public.user_cards SET user_id = t.receiver_id WHERE id = ANY(t.offered_copy_ids) AND user_id = t.sender_id;
  END IF;
  IF coalesce(array_length(t.requested_copy_ids, 1), 0) > 0 THEN
    UPDATE public.user_cards SET user_id = t.sender_id WHERE id = ANY(t.requested_copy_ids) AND user_id = t.receiver_id;
  END IF;

  IF t.offered_coins > 0 OR t.requested_coins > 0 THEN
    UPDATE public.profiles SET coins = coins - t.offered_coins + t.requested_coins WHERE id = t.sender_id;
    UPDATE public.profiles SET coins = coins - t.requested_coins + t.offered_coins WHERE id = t.receiver_id;
  END IF;

  UPDATE public.trade_offers SET status = 'accepted', resolved_at = now() WHERE id = _offer_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.decline_or_cancel_trade_offer(_offer_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u uuid := auth.uid();
  t public.trade_offers%ROWTYPE;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO t FROM public.trade_offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND OR t.status <> 'pending' THEN RAISE EXCEPTION 'invalid_trade'; END IF;
  IF u = t.receiver_id THEN
    UPDATE public.trade_offers SET status = 'declined', resolved_at = now() WHERE id = _offer_id;
  ELSIF u = t.sender_id THEN
    UPDATE public.trade_offers SET status = 'cancelled', resolved_at = now() WHERE id = _offer_id;
  ELSE
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.list_trade_offers()
RETURNS TABLE(
  id uuid,
  sender_id uuid,
  receiver_id uuid,
  sender_username text,
  receiver_username text,
  offered_copy_ids uuid[],
  requested_copy_ids uuid[],
  offered_coins integer,
  requested_coins integer,
  status text,
  created_at timestamptz,
  offered_cards jsonb,
  requested_cards jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN QUERY
  SELECT
    t.id, t.sender_id, t.receiver_id,
    s.username AS sender_username,
    r.username AS receiver_username,
    t.offered_copy_ids, t.requested_copy_ids,
    t.offered_coins, t.requested_coins,
    t.status, t.created_at,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id', uc.id, 'card_id', uc.card_id, 'transcended', uc.transcended)) FROM public.user_cards uc WHERE uc.id = ANY(t.offered_copy_ids)), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(jsonb_build_object('id', uc.id, 'card_id', uc.card_id, 'transcended', uc.transcended)) FROM public.user_cards uc WHERE uc.id = ANY(t.requested_copy_ids)), '[]'::jsonb)
  FROM public.trade_offers t
  JOIN public.profiles s ON s.id = t.sender_id
  JOIN public.profiles r ON r.id = t.receiver_id
  WHERE u IN (t.sender_id, t.receiver_id)
  ORDER BY t.created_at DESC
  LIMIT 40;
END $$;

REVOKE ALL ON FUNCTION public.list_friend_user_cards(uuid), public.create_trade_offer(uuid, uuid[], uuid[], integer, integer), public.accept_trade_offer(uuid), public.decline_or_cancel_trade_offer(uuid), public.list_trade_offers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_friend_user_cards(uuid), public.create_trade_offer(uuid, uuid[], uuid[], integer, integer), public.accept_trade_offer(uuid), public.decline_or_cancel_trade_offer(uuid), public.list_trade_offers() TO authenticated;
