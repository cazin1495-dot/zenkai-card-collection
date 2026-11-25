CREATE TABLE IF NOT EXISTS public.player_usernames (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  locked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS player_usernames_username_lower_uidx
  ON public.player_usernames (lower(btrim(username)));

ALTER TABLE public.player_usernames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique des pseudos" ON public.player_usernames;
CREATE POLICY "Lecture publique des pseudos"
  ON public.player_usernames FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Insertion unique du pseudo definitif" ON public.player_usernames;
CREATE POLICY "Insertion unique du pseudo definitif"
  ON public.player_usernames FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND locked = true
    AND length(btrim(username)) BETWEEN 2 AND 24
  );

REVOKE UPDATE, DELETE ON public.player_usernames FROM authenticated, anon;
GRANT SELECT, INSERT ON public.player_usernames TO authenticated;
GRANT SELECT ON public.player_usernames TO anon;
