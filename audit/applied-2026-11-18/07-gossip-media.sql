-- ARCHIVE ONLY: applied manually; do not rerun or auto-deploy.
-- KINQSY: isolate gossip-media files from forged post references.
-- Does not change media bucket or delete/reassign files.
BEGIN;
CREATE OR REPLACE FUNCTION public.gossip_media_visible(obj_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM storage.objects o
    JOIN public.posts p ON p.user_id::text = o.owner_id
    WHERE o.bucket_id = 'gossip-media'
      AND o.name = $1
      AND p.category = 'gossip'
      AND p.decor IS NOT NULL
      AND jsonb_typeof(p.decor -> 'objects') = 'array'
      AND (p.decor -> 'objects') @> jsonb_build_array(jsonb_build_object('path', $1))
      AND public.can_view_gossip(p)
  );
$function$;

CREATE POLICY kinqsy_gossip_media_upload_owner
ON storage.objects AS RESTRICTIVE
FOR INSERT TO PUBLIC
WITH CHECK (
  bucket_id <> 'gossip-media'
  OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
);

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'gossip-media' AND public = false
  ) THEN
    RAISE EXCEPTION 'Expected private gossip-media bucket; inspect settings';
  END IF;
END;
$verify$;
COMMIT;

SELECT p.proname, p.prosecdef AS security_definer,
       p.proconfig, pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='gossip_media_visible';
