-- KINQSY: serialize Gossip reaction toggles per actor and post.
-- Replaces function only; does not rewrite existing reactions.
BEGIN;
CREATE OR REPLACE FUNCTION public.gossip_toggle_reaction(p_post_id bigint, p_reaction text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  uid uuid := auth.uid();
  had boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE='28000';
  END IF;
  IF p_reaction IS NULL OR p_reaction NOT IN ('heart','broken') THEN
    RAISE EXCEPTION 'bad reaction' USING ERRCODE='22023';
  END IF;
  IF p_post_id IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE='42501';
  END IF;
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'reaction toggles require read committed isolation';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'kinqsy.gossip.reaction:' || uid::text || ':' || p_post_id::text, 0
  ));
  IF public.can_view_gossip_id(p_post_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE='42501';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.reactions r
    WHERE r.post_id=p_post_id AND r.user_id=uid AND r.reaction=p_reaction
  ) INTO had;
  DELETE FROM public.reactions WHERE post_id=p_post_id AND user_id=uid;
  IF had THEN RETURN 'off'; END IF;
  INSERT INTO public.reactions(post_id,user_id,reaction)
  VALUES(p_post_id,uid,p_reaction)
  ON CONFLICT (user_id,post_id) WHERE post_id IS NOT NULL AND user_id IS NOT NULL
  DO UPDATE SET reaction=EXCLUDED.reaction;
  RETURN 'on';
END;
$function$;
COMMIT;
SELECT pg_catalog.pg_get_functiondef(
 'public.gossip_toggle_reaction(bigint,text)'::pg_catalog.regprocedure
) AS definition;

