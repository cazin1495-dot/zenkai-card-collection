ALTER TABLE public.cards ADD COLUMN voice_audio_url text, ADD COLUMN subtitle_text text;
ALTER TABLE public.profiles ADD COLUMN coins bigint NOT NULL DEFAULT 500, ADD COLUMN xp bigint NOT NULL DEFAULT 0, ADD COLUMN level integer NOT NULL DEFAULT 1, ADD COLUMN bonus_boosters integer NOT NULL DEFAULT 0, ADD COLUMN reward_packs jsonb NOT NULL DEFAULT '{}', ADD COLUMN cosmetics jsonb NOT NULL DEFAULT '{}', ADD COLUMN mission_started_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN mission_opened integer NOT NULL DEFAULT 0, ADD COLUMN mission_recycled integer NOT NULL DEFAULT 0, ADD COLUMN mission_claims text[] NOT NULL DEFAULT ARRAY[]::text[];
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE(username) ON public.profiles TO authenticated;
CREATE OR REPLACE FUNCTION public.booster_rarity_for_roll(_roll numeric) RETURNS public.card_rarity LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE WHEN _roll<0.02 THEN 'transcendance'::public.card_rarity WHEN _roll<0.6 THEN 'mythique'::public.card_rarity WHEN _roll<3 THEN 'legendaire'::public.card_rarity WHEN _roll<9 THEN 'epique'::public.card_rarity WHEN _roll<24 THEN 'rare'::public.card_rarity WHEN _roll<50 THEN 'non_commune'::public.card_rarity ELSE 'commune'::public.card_rarity END $$;
CREATE OR REPLACE FUNCTION public.attempt_transcendance(_user_card_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'manual_evolution_removed'; END $$;
REVOKE ALL ON FUNCTION public.attempt_transcendance(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.xp_required(_level integer) RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT _level::bigint*150+(_level::bigint-1)*(_level::bigint-1)*50 $$;
CREATE FUNCTION public.award_xp(_uid uuid,_amount bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.profiles%ROWTYPE; n integer; k text; c integer;
BEGIN
 SELECT * INTO p FROM public.profiles WHERE id=_uid FOR UPDATE;
 p.xp:=p.xp+_amount;
 WHILE p.level<150 AND p.xp>=public.xp_required(p.level) LOOP
  p.xp:=p.xp-public.xp_required(p.level); p.level:=p.level+1; n:=p.level;
  IF n%15<>0 THEN p.coins:=p.coins+100; p.bonus_boosters:=p.bonus_boosters+1;
  ELSE
   c:=CASE n WHEN 15 THEN 300 WHEN 30 THEN 500 WHEN 45 THEN 800 WHEN 60 THEN 1000 WHEN 90 THEN 1500 WHEN 135 THEN 2500 ELSE 0 END; p.coins:=p.coins+c;
   k:=CASE n WHEN 15 THEN 'rare' WHEN 30 THEN 'epique' WHEN 45 THEN 'epique' WHEN 60 THEN 'legendaire' WHEN 75 THEN 'sceau_mythique' WHEN 90 THEN 'legendaire' WHEN 120 THEN 'sceau_mythique' WHEN 135 THEN 'divin_mythique' WHEN 150 THEN 'divin_transcendance' ELSE NULL END;
   IF k IS NOT NULL THEN p.reward_packs:=jsonb_set(p.reward_packs,ARRAY[k],to_jsonb(coalesce((p.reward_packs->>k)::integer,0)+1)); END IF;
   IF n=30 THEN p.cosmetics:=p.cosmetics||'{"frame":"argent"}'; END IF;
   IF n IN (45,90) THEN p.cosmetics:=p.cosmetics||jsonb_build_object('showcase_slots',coalesce((p.cosmetics->>'showcase_slots')::integer,0)+1); END IF;
   IF n=75 THEN p.cosmetics:=p.cosmetics||'{"frame":"or"}'; END IF;
   IF n=105 THEN p.cosmetics:=p.cosmetics||'{"custom_banner":true}'; END IF;
   IF n=120 THEN p.cosmetics:=p.cosmetics||'{"aura":true}'; END IF;
   IF n=150 THEN p.cosmetics:=p.cosmetics||'{"crown":true,"cosmic_aura":true,"exclusive_banner":true}'; END IF;
  END IF;
 END LOOP;
 UPDATE public.profiles SET xp=p.xp,level=p.level,coins=p.coins,bonus_boosters=p.bonus_boosters,reward_packs=p.reward_packs,cosmetics=p.cosmetics WHERE id=_uid;
END $$;
REVOKE ALL ON FUNCTION public.award_xp(uuid,bigint) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.sync_daily(_uid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 UPDATE public.profiles SET mission_started_at=now(),mission_opened=0,mission_recycled=0,mission_claims=ARRAY[]::text[] WHERE id=_uid AND mission_started_at+interval '24 hours'<=now();
END $$;
REVOKE ALL ON FUNCTION public.sync_daily(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.game_state() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); p public.profiles%ROWTYPE; BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=u FOR UPDATE; PERFORM public.sync_daily(u);
 SELECT * INTO p FROM public.profiles WHERE id=u; IF NOT FOUND THEN RAISE EXCEPTION 'profile_missing'; END IF;
 RETURN to_jsonb(p)-'id'-'last_booster_at'-'created_at'; END $$;
CREATE FUNCTION public.claim_mission(_mission text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); p public.profiles%ROWTYPE; x integer:=0; c integer;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=u FOR UPDATE; PERFORM public.sync_daily(u);
 SELECT * INTO p FROM public.profiles WHERE id=u;
 IF _mission=ANY(p.mission_claims) THEN RAISE EXCEPTION 'already_claimed'; END IF;
 IF _mission='login' THEN c:=100;
 ELSIF _mission='open' AND p.mission_opened>=3 THEN c:=50; x:=30;
 ELSIF _mission='recycle' AND p.mission_recycled>=2 THEN c:=50; x:=25;
 ELSE RAISE EXCEPTION 'mission_incomplete'; END IF;
 UPDATE public.profiles SET coins=coins+c,mission_claims=array_append(mission_claims,_mission) WHERE id=u;
 IF cardinality(p.mission_claims)=2 THEN UPDATE public.profiles SET bonus_boosters=bonus_boosters+1 WHERE id=u; END IF;
 PERFORM public.award_xp(u,x); RETURN public.game_state();
END $$;
CREATE FUNCTION public.buy_boosters(_count integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _count IS NULL OR _count NOT IN (1,5,10) THEN RAISE EXCEPTION 'invalid_count'; END IF;
 UPDATE public.profiles SET coins=coins-100*_count,bonus_boosters=bonus_boosters+_count WHERE id=u AND coins>=100*_count;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_enough_coins'; END IF; RETURN public.game_state(); END $$;
REVOKE ALL ON FUNCTION public.game_state(),public.claim_mission(text),public.buy_boosters(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.game_state(),public.claim_mission(text),public.buy_boosters(integer) TO authenticated;
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
   ELSE r:=public.booster_rarity_for_roll(roll); END IF;
   IF i=5 AND special IS NOT NULL AND special<>'divin_transcendance' AND NOT myth THEN r:=CASE WHEN special IN ('sceau_mythique','divin_mythique') THEN 'mythique'::public.card_rarity ELSE special::public.card_rarity END; END IF;
   IF pity>=199 AND i=5 AND NOT myth THEN r:='mythique'; END IF;
   SELECT c.id INTO cid FROM public.cards c WHERE c.active AND c.rarity=r AND (c.category=genre OR (genre='antagoniste' AND c.role='antagoniste') OR (genre='protagoniste' AND c.role='protagoniste')) ORDER BY random() LIMIT 1;
   IF cid IS NULL AND genre='protagoniste' THEN SELECT c.id INTO cid FROM public.cards c WHERE c.active AND c.rarity=r AND c.role IS DISTINCT FROM 'antagoniste' ORDER BY random() LIMIT 1; END IF;
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