DO $migration$
DECLARE _definition text;
BEGIN
 SELECT pg_get_functiondef('public.open_boosters(text,integer)'::regprocedure) INTO _definition;
 _definition := replace(_definition,
 '   -- Never substitute another rarity: missing pools must not silently change probabilities or bypass pity.',
 '   -- Fill missing Protagoniste tiers with allied non-antagonists, never another rarity.
   IF _card IS NULL AND _category=''protagoniste'' THEN
    SELECT c.id INTO _card FROM public.cards c WHERE c.active AND c.rarity=_rarity
     AND c.role IS DISTINCT FROM ''antagoniste'' ORDER BY random() LIMIT 1;
   END IF;
   -- Never substitute another rarity: missing pools must not silently change probabilities or bypass pity.');
 EXECUTE _definition;
END;
$migration$;