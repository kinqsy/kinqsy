-- Read-only RPC proposal. Creates a function; does not delete or anonymize any rows.
BEGIN;
CREATE OR REPLACE FUNCTION public.preview_account_deletion()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE viewer uuid:=auth.uid(); result jsonb;
BEGIN
 IF viewer IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE='42501'; END IF;
 WITH owned AS (
   SELECT id,category,visibility,visible_to FROM public.posts WHERE user_id=viewer
 ), removed AS (
   SELECT id FROM owned WHERE category IS DISTINCT FROM 'gossip' OR visibility='only_me'
 ), retained AS (
   SELECT id,visibility,visible_to FROM owned WHERE category='gossip' AND visibility IN('kinqsy','friends','selected')
 ), friends AS (
   SELECT DISTINCT CASE WHEN requester_id=viewer THEN addressee_id ELSE requester_id END AS id
   FROM public.friendships WHERE status='accepted' AND (requester_id=viewer OR addressee_id=viewer)
 ), sessions AS (
   SELECT id FROM public.chat_sessions WHERE user_a=viewer OR user_b=viewer
 )
 SELECT jsonb_build_object(
   'personal_posts_to_delete',(SELECT count(*) FROM owned WHERE category IS DISTINCT FROM 'gossip'),
   'only_me_gossip_to_delete',(SELECT count(*) FROM owned WHERE category='gossip' AND visibility='only_me'),
   'gossip_to_anonymize',(SELECT count(*) FROM retained),
   'gossip_needing_manual_review',(SELECT count(*) FROM owned WHERE category='gossip' AND (visibility IS NULL OR visibility NOT IN('kinqsy','friends','selected','only_me'))),
   'restricted_audience_links_to_preserve',(SELECT count(*) FROM retained p CROSS JOIN friends f WHERE f.id<>viewer AND (p.visibility='friends' OR (p.visibility='selected' AND f.id=ANY(p.visible_to)))),
   'own_gossip_comments_to_anonymize',(SELECT count(*) FROM public.comments c JOIN public.posts p ON p.id=c.post_id WHERE c.user_id=viewer AND p.category='gossip' AND NOT EXISTS(SELECT 1 FROM removed d WHERE d.id=p.id)),
   'comments_removed_with_posts',(SELECT count(*) FROM public.comments c WHERE c.post_id IN(SELECT id FROM removed)),
   'own_other_comments_to_delete',(SELECT count(*) FROM public.comments c LEFT JOIN public.posts p ON p.id=c.post_id WHERE c.user_id=viewer AND p.category IS DISTINCT FROM 'gossip' AND NOT EXISTS(SELECT 1 FROM removed d WHERE d.id=c.post_id)),
   'sessions_to_close',(SELECT count(*) FROM sessions),
   'messages_removed_with_sessions',(SELECT count(*) FROM public.messages WHERE session_id IN(SELECT id FROM sessions)),
   'tracks_to_delete',(SELECT count(*) FROM public.tracks WHERE user_id=viewer),
   'playlists_to_delete',(SELECT count(*) FROM public.playlists WHERE user_id=viewer),
   'storage_objects_requiring_classification',(SELECT count(*) FROM storage.objects WHERE owner_id=viewer::text),
   'moderation_reports_on_removed_posts',(SELECT count(*) FROM public.gossip_reports WHERE post_id IN(SELECT id FROM removed)),
   'submitted_reports_requiring_anonymization',(SELECT count(*) FROM public.gossip_reports WHERE user_id=viewer),
   'feedback_requiring_review',(SELECT count(*) FROM public.admin_feedback WHERE user_id=viewer),
   'owner_account_protected',viewer='4923abc5-5c86-48c2-904b-a267c2e21703'::uuid,
   'preview_only',true
 ) INTO result;
 RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public.preview_account_deletion() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preview_account_deletion() TO authenticated;
COMMIT;
SELECT p.proname AS function_name,p.proconfig AS settings,
 pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_catalog.pg_proc p WHERE p.oid='public.preview_account_deletion()'::regprocedure;

