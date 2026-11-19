CREATE TABLE public.booster_pity (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 counter integer NOT NULL DEFAULT 0 CHECK (counter BETWEEN 0 AND 199)
);
GRANT SELECT ON public.booster_pity TO authenticated;
GRANT ALL ON public.booster_pity TO service_role;
ALTER TABLE public.booster_pity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own pity" ON public.booster_pity FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.booster_rarity_for_roll(_roll numeric) RETURNS public.card_rarity LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT CASE WHEN _roll < 0.6 THEN 'mythique'::public.card_rarity
 WHEN _roll < 3.0 THEN 'legendaire'::public.card_rarity
 WHEN _roll < 9.0 THEN 'epique'::public.card_rarity
 WHEN _roll < 24.0 THEN 'rare'::public.card_rarity
 WHEN _roll < 50.0 THEN 'non_commune'::public.card_rarity
 ELSE 'commune'::public.card_rarity END;
$$;
REVOKE ALL ON FUNCTION public.booster_rarity_for_roll(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booster_rarity_for_roll(numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.booster_pity_after(_counter integer, _mythic boolean) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT CASE WHEN _mythic THEN 0 ELSE _counter + 1 END;
$$;
REVOKE ALL ON FUNCTION public.booster_pity_after(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booster_pity_after(integer, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.open_boosters(_category text, _count integer)
RETURNS TABLE(user_card_id uuid, card_id text, boosters_left integer, stock_updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
 _uid uuid := auth.uid(); _now timestamptz := now();
 _stored integer; _upd timestamptz; _ticks integer; _pity integer;
 _rarity public.card_rarity; _card text; _ucid uuid; _mythic boolean;
 _ids uuid[] := ARRAY[]::uuid[]; _cards text[] := ARRAY[]::text[];
 b integer; i integer;
BEGIN
 IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _count IS NULL OR _count NOT IN (1,5,10) THEN RAISE EXCEPTION 'invalid_count'; END IF;
 IF _category IS NULL OR _category NOT IN ('shonen','seinen','shojo','sport','antagoniste','protagoniste') THEN RAISE EXCEPTION 'invalid_category'; END IF;
 INSERT INTO public.profiles(id,username) VALUES (_uid,'joueur') ON CONFLICT(id) DO NOTHING;
 SELECT p.boosters_stored,p.stock_updated_at INTO _stored,_upd FROM public.profiles p WHERE p.id=_uid FOR UPDATE;
 _ticks := greatest(0,floor(extract(epoch FROM (_now-_upd))/600)::integer);
 IF _stored + _ticks >= 15 THEN _stored:=15; _upd:=_now;
 ELSE _stored:=_stored+_ticks; _upd:=_upd+make_interval(mins=>_ticks*10); END IF;
 IF _stored < _count THEN RAISE EXCEPTION 'not_enough_boosters'; END IF;
 IF _stored=15 THEN _upd:=_now; END IF;
 _stored:=_stored-_count;
 INSERT INTO public.booster_pity(user_id) VALUES (_uid) ON CONFLICT(user_id) DO NOTHING;
 SELECT p.counter INTO _pity FROM public.booster_pity p WHERE p.user_id=_uid FOR UPDATE;
 FOR b IN 1.._count LOOP
  _mythic:=false;
  FOR i IN 1..5 LOOP
   _rarity:=public.booster_rarity_for_roll((random()*100)::numeric);
   IF _pity >= 199 AND i=5 AND NOT _mythic THEN _rarity:='mythique'; END IF;
   SELECT c.id INTO _card FROM public.cards c WHERE c.active AND c.rarity=_rarity AND
    (c.category=_category OR (_category='antagoniste' AND c.role='antagoniste') OR (_category='protagoniste' AND c.role='protagoniste')) ORDER BY random() LIMIT 1;
   -- Never substitute another rarity: missing pools must not silently change probabilities or bypass pity.
   IF _card IS NULL THEN RAISE EXCEPTION 'empty_rarity_pool'; END IF;
   _mythic:=_mythic OR _rarity='mythique';
   INSERT INTO public.user_cards(user_id,card_id) VALUES(_uid,_card) RETURNING id INTO _ucid;
   _ids:=_ids||_ucid; _cards:=_cards||_card;
  END LOOP;
  _pity:=public.booster_pity_after(_pity,_mythic);
 END LOOP;
 UPDATE public.booster_pity SET counter=_pity WHERE user_id=_uid;
 UPDATE public.profiles SET boosters_stored=_stored,stock_updated_at=_upd,last_booster_at=_now WHERE id=_uid;
 RETURN QUERY SELECT u.id,u.c,_stored,_upd FROM unnest(_ids,_cards) AS u(id,c);
END;
$function$;
REVOKE ALL ON FUNCTION public.open_boosters(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_boosters(text,integer) TO authenticated, service_role;