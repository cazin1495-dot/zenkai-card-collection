CREATE TABLE public.friendships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, DELETE ON public.friendships TO authenticated;
GRANT UPDATE(status) ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX friendships_unique_pair ON public.friendships (least(requester_id,addressee_id), greatest(requester_id,addressee_id));
CREATE INDEX friendships_requester ON public.friendships(requester_id);
CREATE INDEX friendships_addressee ON public.friendships(addressee_id);
CREATE POLICY "Participants read friendships" ON public.friendships FOR SELECT TO authenticated USING ((select auth.uid()) IN (requester_id,addressee_id));
CREATE POLICY "Requester sends pending friendship" ON public.friendships FOR INSERT TO authenticated WITH CHECK (requester_id=(select auth.uid()) AND status='pending');
CREATE POLICY "Recipient accepts pending friendship" ON public.friendships FOR UPDATE TO authenticated USING (addressee_id=(select auth.uid()) AND status='pending') WITH CHECK (addressee_id=(select auth.uid()) AND status='accepted');
CREATE POLICY "Participants remove friendship" ON public.friendships FOR DELETE TO authenticated USING (addressee_id=(select auth.uid()) OR requester_id=(select auth.uid()));
CREATE FUNCTION public.find_friend_player(_username text) RETURNS TABLE(id uuid,username text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _username IS NULL OR length(btrim(_username))<1 OR length(btrim(_username))>100 THEN RETURN; END IF;
 RETURN QUERY SELECT p.id,p.username FROM public.profiles p WHERE lower(btrim(p.username))=lower(btrim(_username)) ORDER BY p.id LIMIT 2;
END $$;
CREATE FUNCTION public.list_friendships() RETURNS TABLE(id uuid,requester_id uuid,addressee_id uuid,status text,created_at timestamptz,requester_username text,addressee_username text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 RETURN QUERY SELECT f.id,f.requester_id,f.addressee_id,f.status,f.created_at,r.username,a.username FROM public.friendships f JOIN public.profiles r ON r.id=f.requester_id JOIN public.profiles a ON a.id=f.addressee_id WHERE auth.uid() IN (f.requester_id,f.addressee_id) ORDER BY f.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.find_friend_player(text),public.list_friendships() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.find_friend_player(text),public.list_friendships() TO authenticated;