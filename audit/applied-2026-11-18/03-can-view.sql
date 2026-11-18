-- ARCHIVE ONLY: applied manually; do not rerun or auto-deploy.
-- Historical record: already applied manually. Do not rerun automatically.
BEGIN;
CREATE OR REPLACE FUNCTION public.can_view(owner uuid, section text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$
 SELECT CASE
 WHEN $1 IS NOT NULL AND $1=auth.uid() THEN true
 WHEN auth.uid() IS NULL THEN false
 WHEN NOT EXISTS(SELECT 1 FROM public.privacy_settings s WHERE s.owner_id=$1 AND s.section=$2)
 THEN public.are_friends($1,auth.uid())
 ELSE (SELECT CASE s.mode
 WHEN 'public' THEN true WHEN 'only_me' THEN false
 WHEN 'friends' THEN public.are_friends($1,auth.uid())
 WHEN 'selected' THEN auth.uid()=ANY(s.friend_ids)
 ELSE false END
 FROM public.privacy_settings s WHERE s.owner_id=$1 AND s.section=$2 LIMIT 1)
 END;
$$;
COMMIT;
