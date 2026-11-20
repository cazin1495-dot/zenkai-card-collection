CREATE FUNCTION public.recycle_value(_rarity public.card_rarity,_popularity integer) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT ceil((CASE _rarity WHEN 'commune' THEN 0.1 WHEN 'non_commune' THEN 0.25 WHEN 'rare' THEN 0.5 WHEN 'epique' THEN 1.5 WHEN 'legendaire' THEN 4 WHEN 'mythique' THEN 10 WHEN 'transcendance' THEN 50 END)*greatest(1,least(100,_popularity)))::integer $$;
CREATE FUNCTION public.recycle_copy(_copy uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); c public.user_cards%ROWTYPE; r public.card_rarity; pop integer; gain integer;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=u FOR UPDATE; PERFORM public.sync_daily(u);
 SELECT * INTO c FROM public.user_cards WHERE id=_copy AND user_id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'copy_missing'; END IF;
 IF (SELECT count(*) FROM public.user_cards WHERE user_id=u AND card_id=c.card_id AND transcended=c.transcended)<2 THEN RAISE EXCEPTION 'last_copy_protected'; END IF;
 SELECT rarity,popularity INTO r,pop FROM public.cards WHERE id=c.card_id;
 IF c.transcended THEN r:='transcendance'; END IF;
 gain:=public.recycle_value(r,pop);
 DELETE FROM public.user_cards WHERE id=_copy AND user_id=u;
 UPDATE public.profiles SET coins=coins+gain,mission_recycled=mission_recycled+1 WHERE id=u;
 RETURN gain;
END $$;
REVOKE ALL ON FUNCTION public.recycle_copy(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.recycle_copy(uuid) TO authenticated;