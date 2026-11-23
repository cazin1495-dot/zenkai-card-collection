-- Synchronisation globale des raretés modifiées par le propriétaire (Dai / cazin1495@gmail.com)
CREATE TABLE IF NOT EXISTS public.card_rarity_overrides (
  card_key text PRIMARY KEY,
  rarity text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.card_rarity_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique des raretes" ON public.card_rarity_overrides;
CREATE POLICY "Lecture publique des raretes"
  ON public.card_rarity_overrides
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Modification reservee au proprietaire" ON public.card_rarity_overrides;
CREATE POLICY "Modification reservee au proprietaire"
  ON public.card_rarity_overrides
  FOR ALL
  TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'cazin1495@gmail.com')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'cazin1495@gmail.com');

GRANT SELECT ON public.card_rarity_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.card_rarity_overrides TO authenticated;
