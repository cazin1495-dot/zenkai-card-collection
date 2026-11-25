-- Balanced standard drop rates (44 / 31.5 / 17.5 / 5 / 1.6 / 0.35 / 0.05) + anti-duplicate batch protection (Zenkai rates unchanged)

CREATE OR REPLACE FUNCTION public.booster_rarity_for_roll(_roll numeric)
RETURNS public.card_rarity
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  IF _roll < 44 THEN RETURN 'commune';
  ELSIF _roll < 75.5 THEN RETURN 'non_commune';
  ELSIF _roll < 93 THEN RETURN 'rare';
  ELSIF _roll < 98 THEN RETURN 'epique';
  ELSIF _roll < 99.6 THEN RETURN 'legendaire';
  ELSIF _roll < 99.95 THEN RETURN 'mythique';
  ELSE RETURN 'transcendance';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.open_boosters(_category text,_count integer) RETURNS TABLE(user_card_id uuid,card_id text,boosters_left integer,stock_updated_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); t timestamptz:=now(); p public.profiles%ROWTYPE; ticks integer; pity integer; r public.card_rarity; cid text; ucid uuid; myth boolean; ids uuid[]:=ARRAY[]::uuid[]; cids text[]:=ARRAY[]::text[]; b integer; i integer; x bigint:=0; special text; genre text:=_category; roll numeric;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _count IS NULL OR _count NOT IN (1,5,10) THEN RAISE EXCEPTION 'invalid_count'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=u FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'profile_missing'; END IF;
 PERFORM public.sync_daily(u);
 IF _category LIKE 'reward:%' THEN
  special:=substr(_category,8); genre:='shonen';
  IF special NOT IN ('rare','epique','legendaire','sceau_mythique','divin_mythique','divin_transcendance') OR _count<>1 OR coalesce((p.reward_packs->>special)::integer,0)<1 THEN RAISE EXCEPTION 'reward_unavailable'; END IF;
  UPDATE public.profiles SET reward_packs=jsonb_set(reward_packs,ARRAY[special],to_jsonb((reward_packs->>special)::integer-1)) WHERE id=u;
 ELSE
  IF _category IS NULL OR _category NOT IN ('shonen','seinen','shojo','sport','antagoniste','protagoniste') THEN RAISE EXCEPTION 'invalid_category'; END IF;
 END IF;
 ticks:=greatest(0,floor(extract(epoch FROM(t-p.stock_updated_at))/600)::integer);
 IF p.boosters_stored+ticks>=15 THEN p.boosters_stored:=15; p.stock_updated_at:=t; ELSE p.boosters_stored:=p.boosters_stored+ticks; p.stock_updated_at:=p.stock_updated_at+make_interval(mins=>ticks*10); END IF;
 IF special IS NULL THEN
  IF p.boosters_stored+p.bonus_boosters<_count THEN RAISE EXCEPTION 'not_enough_boosters'; END IF;
  IF p.boosters_stored>=_count THEN p.boosters_stored:=p.boosters_stored-_count;
  ELSE p.bonus_boosters:=p.bonus_boosters-(_count-p.boosters_stored); p.boosters_stored:=0; END IF;
 END IF;
 INSERT INTO public.booster_pity(user_id) VALUES(u) ON CONFLICT DO NOTHING;
 SELECT counter INTO pity FROM public.booster_pity WHERE user_id=u FOR UPDATE;
 FOR b IN 1.._count LOOP
  myth:=false; x:=x+10;
  FOR i IN 1..5 LOOP
   roll:=(random()*100)::numeric;
   IF special='divin_transcendance' THEN
    r:=CASE WHEN roll<0.04 THEN 'transcendance'::public.card_rarity WHEN roll<0.6 THEN 'mythique'::public.card_rarity ELSE public.booster_rarity_for_roll(roll) END;
      IF count = 10 AND b = 10 AND i = 5 AND NOT has_epique_plus THEN
        r := 'epique';
      END IF;
      IF r IN ('epique', 'legendaire', 'mythique', 'transcendance') THEN
        has_epique_plus := true;
      END IF;
   ELSE r:=public.booster_rarity_for_roll(roll); END IF;
   IF i=5 AND special IS NOT NULL AND special<>'divin_transcendance' AND NOT myth THEN r:=CASE WHEN special IN ('sceau_mythique','divin_mythique') THEN 'mythique'::public.card_rarity ELSE special::public.card_rarity END; END IF;
   IF pity>=49 AND i=5 AND NOT myth THEN r:='mythique'; END IF;
   SELECT c.id INTO cid FROM public.cards c
      WHERE c.active AND c.rarity=r
        AND (genre='zenkai' OR c.category=genre OR (genre='antagoniste' AND c.role='antagoniste') OR (genre='protagoniste' AND c.role='protagoniste'))
        AND NOT (c.id = ANY(cids))
      ORDER BY
        CASE WHEN random() < 0.5 AND NOT EXISTS (SELECT 1 FROM public.user_cards uc WHERE uc.user_id=u AND uc.card_id=c.id) THEN 0 ELSE 1 END,
        random()
      LIMIT 1;
      IF cid IS NULL AND genre='protagoniste' THEN
        SELECT c.id INTO cid FROM public.cards c
        WHERE c.active AND c.rarity=r AND c.role IS DISTINCT FROM 'antagoniste' AND NOT (c.id = ANY(cids))
        ORDER BY random() LIMIT 1;
      END IF;
      IF cid IS NULL THEN
        SELECT c.id INTO cid FROM public.cards c
        WHERE c.active AND c.rarity=r
          AND (genre='zenkai' OR c.category=genre OR (genre='antagoniste' AND c.role='antagoniste') OR (genre='protagoniste' AND c.role='protagoniste'))
        ORDER BY random() LIMIT 1;
      END IF;
      IF cid IS NULL AND genre='protagoniste' THEN
        SELECT c.id INTO cid FROM public.cards c
        WHERE c.active AND c.rarity=r AND c.role IS DISTINCT FROM 'antagoniste'
        ORDER BY random() LIMIT 1;
      END IF;
   IF cid IS NULL THEN RAISE EXCEPTION 'empty_rarity_pool'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.user_cards WHERE user_id=u AND card_id=cid) THEN x:=x+20; END IF;
   myth:=myth OR r='mythique';
   INSERT INTO public.user_cards(user_id,card_id) VALUES(u,cid) RETURNING id INTO ucid; ids:=ids||ucid; cids:=cids||cid;
  END LOOP;
  pity:=public.booster_pity_after(pity,myth);
 END LOOP;
 UPDATE public.booster_pity SET counter=pity WHERE user_id=u;
 UPDATE public.profiles SET boosters_stored=p.boosters_stored,bonus_boosters=p.bonus_boosters,stock_updated_at=p.stock_updated_at,last_booster_at=t,mission_opened=mission_opened+_count WHERE id=u;
 PERFORM public.award_xp(u,x);
 RETURN QUERY SELECT a.id,a.c,p.boosters_stored,p.stock_updated_at FROM unnest(ids,cids) AS a(id,c);
END $$;
REVOKE ALL ON FUNCTION public.open_boosters(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.open_boosters(text,integer) TO authenticated;