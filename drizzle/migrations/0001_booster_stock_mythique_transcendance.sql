ALTER TYPE public.card_rarity ADD VALUE IF NOT EXISTS 'mythique';

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS series text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS quote text,
  ADD COLUMN IF NOT EXISTS anilist_id integer,
  ADD COLUMN IF NOT EXISTS popularity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.user_cards
  ADD COLUMN IF NOT EXISTS awaken_attempted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transcended boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS boosters_stored integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS stock_updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.profiles.last_booster_at IS 'DEPRECATED: replaced by boosters_stored + stock_updated_at';

REVOKE EXECUTE ON FUNCTION public.open_booster() FROM authenticated, anon, public;
COMMENT ON FUNCTION public.open_booster() IS 'DEPRECATED: replaced by open_boosters(text,int)';

CREATE OR REPLACE FUNCTION public.open_boosters(_category text, _count integer)
RETURNS TABLE(user_card_id uuid, card_id text, boosters_left integer, stock_updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _now timestamptz := now();
  _cap int := 15;
  _stored int;
  _upd timestamptz;
  _ticks int;
  _roll numeric;
  _rarity public.card_rarity;
  _card text;
  _ucid uuid;
  _ids uuid[] := ARRAY[]::uuid[];
  _cards text[] := ARRAY[]::text[];
  i int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _count NOT IN (1, 5, 10) THEN RAISE EXCEPTION 'invalid_count'; END IF;
  IF _category NOT IN ('shonen','seinen','shojo','sport','antagoniste','protagoniste') THEN
    RAISE EXCEPTION 'invalid_category';
  END IF;

  INSERT INTO public.profiles (id, username) VALUES (_uid, 'joueur') ON CONFLICT (id) DO NOTHING;
  SELECT p.boosters_stored, p.stock_updated_at INTO _stored, _upd FROM public.profiles p WHERE p.id = _uid FOR UPDATE;

  _ticks := floor(extract(epoch FROM (_now - _upd)) / 600)::int;
  IF _stored + _ticks >= _cap THEN
    _stored := _cap; _upd := _now;
  ELSE
    _stored := _stored + _ticks; _upd := _upd + make_interval(mins => _ticks * 10);
  END IF;

  IF _stored < _count THEN RAISE EXCEPTION 'not_enough_boosters'; END IF;
  IF _stored = _cap THEN _upd := _now; END IF;
  _stored := _stored - _count;

  FOR i IN 1..(_count * 5) LOOP
    _roll := random() * 100;
    _rarity := CASE
      WHEN _roll < 2.7 THEN 'mythique'::public.card_rarity
      WHEN _roll < 5.7 THEN 'legendaire'::public.card_rarity
      WHEN _roll < 15.7 THEN 'epique'::public.card_rarity
      WHEN _roll < 42.7 THEN 'rare'::public.card_rarity
      ELSE 'commune'::public.card_rarity
    END;
    SELECT c.id INTO _card FROM public.cards c
      WHERE c.active AND c.rarity = _rarity AND (
        c.category = _category
        OR (_category = 'antagoniste' AND c.role = 'antagoniste')
        OR (_category = 'protagoniste' AND c.role = 'protagoniste'))
      ORDER BY random() LIMIT 1;
    IF _card IS NULL THEN
      SELECT c.id INTO _card FROM public.cards c
        WHERE c.active AND (
          c.category = _category
          OR (_category = 'antagoniste' AND c.role = 'antagoniste')
          OR (_category = 'protagoniste' AND c.role = 'protagoniste'))
        ORDER BY random() LIMIT 1;
    END IF;
    IF _card IS NULL THEN RAISE EXCEPTION 'empty_pool'; END IF;
    INSERT INTO public.user_cards (user_id, card_id) VALUES (_uid, _card) RETURNING id INTO _ucid;
    _ids := _ids || _ucid;
    _cards := _cards || _card;
    _card := NULL;
  END LOOP;

  UPDATE public.profiles SET boosters_stored = _stored, stock_updated_at = _upd, last_booster_at = _now WHERE id = _uid;

  RETURN QUERY SELECT u.id, u.c, _stored, _upd FROM unnest(_ids, _cards) AS u(id, c);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.open_boosters(text, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.open_boosters(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.attempt_transcendance(_user_card_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rarity public.card_rarity;
  _attempted boolean;
  _ok boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT c.rarity, uc.awaken_attempted INTO _rarity, _attempted
    FROM public.user_cards uc JOIN public.cards c ON c.id = uc.card_id
    WHERE uc.id = _user_card_id AND uc.user_id = _uid
    FOR UPDATE OF uc;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _rarity <> 'mythique' THEN RAISE EXCEPTION 'not_mythique'; END IF;
  IF _attempted THEN RAISE EXCEPTION 'already_attempted'; END IF;
  _ok := random() < 0.01;
  UPDATE public.user_cards SET awaken_attempted = true, transcended = _ok WHERE id = _user_card_id;
  RETURN _ok;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.attempt_transcendance(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.attempt_transcendance(uuid) TO authenticated;