CREATE OR REPLACE FUNCTION public.enforce_no_transcendance_trade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_cards uc
    LEFT JOIN public.cards c ON c.id = uc.card_id
    WHERE uc.id = ANY(coalesce(NEW.offered_copy_ids, '{}') || coalesce(NEW.requested_copy_ids, '{}'))
      AND (uc.transcended = true OR c.rarity = 'transcendance')
  ) THEN
    RAISE EXCEPTION 'Les cartes Transcendance ne sont ni vendables ni echangeables.';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.trade_offers') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_no_transcendance_trade ON public.trade_offers;
    CREATE TRIGGER trg_no_transcendance_trade
      BEFORE INSERT OR UPDATE ON public.trade_offers
      FOR EACH ROW EXECUTE FUNCTION public.enforce_no_transcendance_trade();
  END IF;
END $$;
