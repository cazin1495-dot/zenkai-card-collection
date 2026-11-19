DO $migration$
DECLARE _definition text;
BEGIN
 SELECT pg_get_functiondef('public.open_boosters(text,integer)'::regprocedure) INTO _definition;
 IF position('   -- Never substitute another rarity:' IN _definition)=0 THEN RAISE EXCEPTION 'missing_test_insertion_point'; END IF;
 _definition:=replace(_definition,
 '   -- Never substitute another rarity:',
 '   -- TEMPORARY GOKU TEST: every card in every pack is the owned Mythique base copy.
   SELECT c.id INTO _card FROM public.cards c WHERE c.id=''al-246'' AND c.active AND c.rarity=''mythique'';
   _rarity:=''mythique'';
   -- Never substitute another rarity:');
 EXECUTE _definition;
END;
$migration$;
CREATE OR REPLACE FUNCTION public.attempt_transcendance(_user_card_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE _uid uuid:=auth.uid(); _rarity public.card_rarity; _attempted boolean;
BEGIN
 IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 SELECT c.rarity,uc.awaken_attempted INTO _rarity,_attempted
 FROM public.user_cards uc JOIN public.cards c ON c.id=uc.card_id
 WHERE uc.id=_user_card_id AND uc.user_id=_uid FOR UPDATE OF uc;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF _rarity<>'mythique' THEN RAISE EXCEPTION 'not_mythique'; END IF;
 IF _attempted THEN RAISE EXCEPTION 'already_attempted'; END IF;
 -- TEMPORARY TEST: 100% success, one attempt per owned Mythique copy.
 UPDATE public.user_cards SET awaken_attempted=true,transcended=true WHERE id=_user_card_id;
 RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.attempt_transcendance(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attempt_transcendance(uuid) TO authenticated,service_role;