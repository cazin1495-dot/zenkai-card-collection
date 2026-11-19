DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.open_boosters(text,integer)'::regprocedure) INTO definition;
  IF position('    IF _card IS NULL THEN RAISE EXCEPTION ''empty_pool''; END IF;' IN definition) = 0 THEN RAISE EXCEPTION 'booster_definition_changed'; END IF;
  definition := replace(definition, '    IF _card IS NULL THEN RAISE EXCEPTION ''empty_pool''; END IF;', '    -- TEMPORARY TEST: Shonen Mix gives Son Goku Mythique on every draw (100%).
    IF _category = ''shonen'' THEN
      SELECT c.id INTO _card FROM public.cards c WHERE c.id = ''al-246'' AND c.active AND c.rarity = ''mythique'' AND c.category = ''shonen'';
    END IF;
    IF _card IS NULL THEN RAISE EXCEPTION ''empty_pool''; END IF;');
  EXECUTE definition;
  SELECT pg_get_functiondef('public.attempt_transcendance(uuid)'::regprocedure) INTO definition;
  IF position('_ok := random() < 0.01;' IN definition) = 0 THEN RAISE EXCEPTION 'awakening_definition_changed'; END IF;
  definition := replace(definition, '_ok := random() < 0.01;', '_ok := true; -- TEMPORARY TEST: 100% success; restore random() < 0.01 afterwards.');
  EXECUTE definition;
END;
$migration$;
REVOKE ALL ON FUNCTION public.open_boosters(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_boosters(text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.attempt_transcendance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attempt_transcendance(uuid) TO authenticated;