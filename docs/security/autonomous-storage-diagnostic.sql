-- READ ONLY. No object paths, user IDs, content, credentials or user functions are returned/executed.
WITH objects AS (
 SELECT id,bucket_id,name,owner_id FROM storage.objects
 WHERE bucket_id IN ('media','gossip-media','user-audio')
), refs AS (
 SELECT o.id,
 (o.bucket_id='user-audio' AND EXISTS (SELECT 1 FROM public.tracks t WHERE t.path=o.name AND t.user_id::text=o.owner_id)) AS track_ref,
 (o.bucket_id IN ('media','gossip-media') AND EXISTS (SELECT 1 FROM public.posts p WHERE p.user_id::text=o.owner_id AND (
   p.media_url='https://rgkfegdtxaojceknnzlr.supabase.co/storage/v1/object/public/media/'||o.name
   OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_path_query(coalesce(p.decor::jsonb,'{}'::jsonb),'$.** ? (@.type() == "string")') j(value)
      WHERE j.value #>> '{}' IN (o.name,'https://rgkfegdtxaojceknnzlr.supabase.co/storage/v1/object/public/media/'||o.name))
 ))) AS post_ref
 FROM objects o
)
SELECT o.bucket_id,count(*) AS objects,
 count(*) FILTER(WHERE o.owner_id IS NULL) AS without_owner,
 count(*) FILTER(WHERE r.track_ref) AS referenced_by_track,
 count(*) FILTER(WHERE r.post_ref) AS referenced_by_post,
 count(*) FILTER(WHERE NOT r.track_ref AND NOT r.post_ref) AS without_detected_reference
FROM objects o JOIN refs r USING(id) GROUP BY o.bucket_id ORDER BY o.bucket_id;
-- No detected reference is NOT proof that a file can be deleted.

