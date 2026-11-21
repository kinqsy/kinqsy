-- MANUAL FOUNDATION ONLY. Does not populate archive rows, anonymize posts, move files or delete accounts.
BEGIN;
CREATE TABLE kinqsy_private.gossip_archive(
 post_id bigint PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
 visibility text NOT NULL CHECK(visibility IN('kinqsy','friends','selected')),
 archived_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE kinqsy_private.gossip_archive_readers(
 post_id bigint NOT NULL REFERENCES kinqsy_private.gossip_archive(post_id) ON DELETE CASCADE,
 viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 PRIMARY KEY(post_id,viewer_id)
);
CREATE TABLE kinqsy_private.gossip_archive_assets(
 post_id bigint NOT NULL REFERENCES kinqsy_private.gossip_archive(post_id) ON DELETE CASCADE,
 bucket_id text NOT NULL CHECK(bucket_id IN('media','gossip-media')),
 object_name text NOT NULL CHECK(object_name<>'' AND object_name !~ '^[a-zA-Z][a-zA-Z0-9+.-]*://' AND object_name !~ '\?'),
 PRIMARY KEY(post_id,bucket_id,object_name)
);
CREATE INDEX gossip_archive_assets_lookup ON kinqsy_private.gossip_archive_assets(bucket_id,object_name);
ALTER TABLE kinqsy_private.gossip_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE kinqsy_private.gossip_archive_readers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kinqsy_private.gossip_archive_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kinqsy_private.gossip_archive,kinqsy_private.gossip_archive_readers,kinqsy_private.gossip_archive_assets FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.kinqsy_can_view_archived_gossip(pid bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM kinqsy_private.gossip_archive a JOIN public.posts p ON p.id=a.post_id
  WHERE a.post_id=$1 AND p.user_id IS NULL AND p.category='gossip' AND p.visibility=a.visibility
  AND (a.visibility='kinqsy' OR EXISTS(
    SELECT 1 FROM kinqsy_private.gossip_archive_readers r WHERE r.post_id=a.post_id AND r.viewer_id=auth.uid()
  ))
 );
$function$;
REVOKE ALL ON FUNCTION public.kinqsy_can_view_archived_gossip(bigint) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.can_view_gossip(p public.posts)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
 SELECT CASE
  WHEN p.category IS DISTINCT FROM 'gossip' THEN false
  WHEN auth.uid() IS NULL THEN false
  WHEN auth.uid()=p.user_id THEN true
  WHEN public.is_admin() THEN true
  WHEN p.user_id IS NULL AND EXISTS(SELECT 1 FROM kinqsy_private.gossip_archive a WHERE a.post_id=p.id)
    THEN public.kinqsy_can_view_archived_gossip(p.id)
  WHEN coalesce(p.visibility,'')='only_me' THEN false
  WHEN coalesce(p.visibility,'')='friends' THEN public.are_friends(auth.uid(),p.user_id)
  WHEN coalesce(p.visibility,'')='kinqsy' THEN true
  WHEN coalesce(p.visibility,'')='selected' THEN auth.uid()=ANY(coalesce(p.visible_to,'{}'::uuid[])) AND public.are_friends(auth.uid(),p.user_id)
  ELSE false END;
$function$;

CREATE OR REPLACE FUNCTION public.kinqsy_archived_asset_visible(asset_bucket text,asset_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM kinqsy_private.gossip_archive_assets a
  JOIN public.posts p ON p.id=a.post_id
  JOIN kinqsy_private.gossip_archive g ON g.post_id=p.id
  JOIN storage.objects o ON o.bucket_id=a.bucket_id AND o.name=a.object_name
  WHERE a.bucket_id=$1 AND a.object_name=$2 AND p.user_id IS NULL AND p.category='gossip'
    AND p.visibility=g.visibility AND nullif(o.owner_id,'') IS NULL
    AND public.can_view_gossip(p)
    AND (p.media_url='https://rgkfegdtxaojceknnzlr.supabase.co/storage/v1/object/public/'||a.bucket_id||'/'||a.object_name
     OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_path_query(coalesce(p.decor::jsonb,'{}'::jsonb),'$.** ? (@.type() == "string")') AS j(value)
       WHERE (j.value #>> '{}') IN(a.object_name,'https://rgkfegdtxaojceknnzlr.supabase.co/storage/v1/object/public/'||a.bucket_id||'/'||a.object_name)))
 );
$function$;
REVOKE ALL ON FUNCTION public.kinqsy_archived_asset_visible(text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.gossip_media_visible(obj_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
 SELECT public.kinqsy_archived_asset_visible('gossip-media',$1) OR (
  auth.uid() IS NOT NULL AND EXISTS(
   SELECT 1 FROM storage.objects o JOIN public.posts p ON p.user_id::text=o.owner_id
   WHERE o.bucket_id='gossip-media' AND o.name=$1 AND p.category='gossip' AND p.decor IS NOT NULL
    AND jsonb_typeof(p.decor->'objects')='array'
    AND (p.decor->'objects') @> jsonb_build_array(jsonb_build_object('path',$1)) AND public.can_view_gossip(p)
  )
 );
$function$;

CREATE OR REPLACE FUNCTION public.kinqsy_can_read_media(object_name text,object_owner text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
 SELECT CASE WHEN auth.uid() IS NULL THEN false
 WHEN object_owner=auth.uid()::text THEN true
 WHEN public.kinqsy_archived_asset_visible('media',$1) THEN true
 ELSE EXISTS(
  SELECT 1 FROM public.posts p WHERE p.user_id::text=$2
   AND CASE WHEN p.category='gossip' THEN public.can_view_gossip(p) ELSE public.can_view(p.user_id,public.post_section(p.category)) END
   AND (p.media_url='https://rgkfegdtxaojceknnzlr.supabase.co/storage/v1/object/public/media/'||$1
    OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_path_query(coalesce(p.decor::jsonb,'{}'::jsonb),'$.** ? (@.type() == "string")') j(value)
      WHERE (j.value #>> '{}') IN($1,'https://rgkfegdtxaojceknnzlr.supabase.co/storage/v1/object/public/media/'||$1)))
 ) END;
$function$;
COMMIT;
SELECT c.relname,c.relrowsecurity FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='kinqsy_private' AND c.relname IN('gossip_archive','gossip_archive_readers','gossip_archive_assets') ORDER BY c.relname;

