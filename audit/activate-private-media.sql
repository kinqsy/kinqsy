-- ACTIVATION: run ONLY after private-media frontend has been deployed.
-- Makes media private. No files, posts or ownership records are removed.
BEGIN;
CREATE OR REPLACE FUNCTION public.kinqsy_can_read_media(object_name text, object_owner text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
 SELECT CASE
 WHEN auth.uid() IS NULL THEN false
 WHEN object_owner = auth.uid()::text THEN true
 ELSE EXISTS (
   SELECT 1 FROM public.posts p
   WHERE p.user_id::text = object_owner
     AND CASE WHEN p.category = 'gossip' THEN public.can_view_gossip(p)
              ELSE public.can_view(p.user_id, public.post_section(p.category)) END
     AND (
       p.media_url = 'https://rgkfegdtxaojceknnzlr.supabase.co/storage/v1/object/public/media/' || object_name
       OR EXISTS (
         SELECT 1 FROM pg_catalog.jsonb_path_query(
           coalesce(p.decor::jsonb, '{}'::jsonb), '$.** ? (@.type() == "string")'
         ) AS j(value)
         WHERE (j.value #>> '{}') = object_name
            OR (j.value #>> '{}') = 'https://rgkfegdtxaojceknnzlr.supabase.co/storage/v1/object/public/media/' || object_name
       )
     )
 ) END;
$$;
REVOKE ALL ON FUNCTION public.kinqsy_can_read_media(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kinqsy_can_read_media(text,text) TO anon, authenticated;
-- Restrictive policies intersect with existing permissive policies.
CREATE POLICY kinqsy_media_read_guard ON storage.objects
AS RESTRICTIVE FOR SELECT TO PUBLIC
USING (bucket_id <> 'media' OR public.kinqsy_can_read_media(name, owner_id));
CREATE POLICY kinqsy_media_upload_guard ON storage.objects
AS RESTRICTIVE FOR INSERT TO PUBLIC
WITH CHECK (bucket_id <> 'media' OR (
 auth.uid() IS NOT NULL AND owner_id = auth.uid()::text
 AND (storage.foldername(name))[1] = auth.uid()::text
));
UPDATE storage.buckets SET public = false WHERE id = 'media';
COMMIT;
SELECT id, public FROM storage.buckets WHERE id = 'media';
-- Ownerless files are NOT granted access or reassigned by this proposal.
-- Existing signed links can remain usable until their original expiry.

