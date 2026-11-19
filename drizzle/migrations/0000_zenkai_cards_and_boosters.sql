-- Rarity enum
CREATE TYPE public.card_rarity AS ENUM ('commune', 'rare', 'epique', 'legendaire');

-- Cards catalog
CREATE TABLE public.cards (
  id text PRIMARY KEY,
  name text NOT NULL,
  title text NOT NULL,
  rarity public.card_rarity NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.cards TO anon, authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cards are readable by everyone" ON public.cards FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.cards (id, name, title, rarity, description, sort_order) VALUES
  ('riku',   'Riku Tanaka',      'Lycéen épéiste',         'commune',    'Il s''entraîne chaque jour sur le toit du lycée avec son sabre de bois.', 1),
  ('mei',    'Mei Kurosawa',     'Mage bibliothécaire',    'commune',    'Timide, mais aucun grimoire ne lui résiste.', 2),
  ('taro',   'Taro Ishida',      'Ninja cuisinier',        'commune',    'Ses ramens sont aussi rapides que ses lames.', 3),
  ('hana',   'Hana Mori',        'Archère de la forêt',    'commune',    'Ses flèches ne manquent jamais leur cible.', 4),
  ('kaito',  'Kaito Ren',        'Samouraï de l''orage',   'rare',       'Son katana appelle la foudre à chaque coup.', 5),
  ('yuki',   'Yuki Shirogane',   'Prêtresse des glaces',   'rare',       'Gardienne d''un sanctuaire enneigé.', 6),
  ('sora',   'Sora Aikawa',      'Pilote de mecha',        'rare',       'Aux commandes du géant d''acier Hayate.', 7),
  ('akira',  'Akira Kagemaru',   'Assassin des ombres',    'epique',     'Les flammes violettes annoncent sa venue.', 8),
  ('lyra',   'Lyra Tsukino',     'Sorcière lunaire',       'epique',     'Elle tire sa magie de la pleine lune.', 9),
  ('ryujin', 'Ryujin',           'Dieu-dragon d''or',      'legendaire', 'Le dragon céleste sous forme humaine. Rarissime.', 10);

-- Player profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  last_booster_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (username) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Players update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'username', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      split_part(COALESCE(NEW.email, 'joueur'), '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Player collections
CREATE TABLE public.user_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id text NOT NULL REFERENCES public.cards(id),
  obtained_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_cards_user_id_idx ON public.user_cards (user_id);
GRANT SELECT ON public.user_cards TO authenticated;
GRANT ALL ON public.user_cards TO service_role;
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own cards" ON public.user_cards FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Open a free booster: 3 random cards, 10 minute cooldown
CREATE OR REPLACE FUNCTION public.open_booster()
RETURNS TABLE (card_id text, next_booster_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _last timestamptz;
  _now timestamptz := now();
  _roll numeric;
  _rarity public.card_rarity;
  _card text;
  _cards text[] := ARRAY[]::text[];
  i int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.profiles (id, username) VALUES (_uid, 'joueur') ON CONFLICT (id) DO NOTHING;

  SELECT p.last_booster_at INTO _last FROM public.profiles p WHERE p.id = _uid FOR UPDATE;

  IF _last IS NOT NULL AND _last + interval '10 minutes' > _now THEN
    RAISE EXCEPTION 'cooldown_active' USING DETAIL = (_last + interval '10 minutes')::text;
  END IF;

  FOR i IN 1..3 LOOP
    _roll := random() * 100;
    _rarity := CASE
      WHEN _roll < 3 THEN 'legendaire'::public.card_rarity
      WHEN _roll < 13 THEN 'epique'::public.card_rarity
      WHEN _roll < 40 THEN 'rare'::public.card_rarity
      ELSE 'commune'::public.card_rarity
    END;
    SELECT c.id INTO _card FROM public.cards c WHERE c.rarity = _rarity ORDER BY random() LIMIT 1;
    INSERT INTO public.user_cards (user_id, card_id) VALUES (_uid, _card);
    _cards := _cards || _card;
  END LOOP;

  UPDATE public.profiles SET last_booster_at = _now WHERE id = _uid;

  RETURN QUERY SELECT unnest(_cards), _now + interval '10 minutes';
END;
$$;

REVOKE ALL ON FUNCTION public.open_booster() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_booster() TO authenticated;