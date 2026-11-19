WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY category, role ORDER BY sort_order, id) AS n
  FROM public.cards WHERE active AND rarity = 'commune'
)
UPDATE public.cards c SET rarity = 'non_commune'::public.card_rarity
FROM ranked r WHERE c.id = r.id AND r.n % 6 = 0;

CREATE OR REPLACE FUNCTION public.open_boosters(_category text, _count integer)
 RETURNS TABLE(user_card_id uuid, card_id text, boosters_left integer, stock_updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      WHEN _roll < 52.7 THEN 'non_commune'::public.card_rarity
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
    -- TEMPORARY TEST: Shonen Mix gives Son Goku Mythique on every draw (100%).
    IF _category = 'shonen' THEN
      SELECT c.id INTO _card FROM public.cards c WHERE c.id = 'al-246' AND c.active AND c.rarity = 'mythique' AND c.category = 'shonen';
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
$function$;