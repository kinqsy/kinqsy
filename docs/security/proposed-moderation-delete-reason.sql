-- PROPOSAL: apply manually after reviewing test results; deploy matching admin.js afterward.
BEGIN;
CREATE OR REPLACE FUNCTION public.content_delete_post(p_id bigint, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  deleted_id bigint;
  reason text := pg_catalog.btrim(p_reason);
BEGIN
  IF auth.uid() IS NULL OR public.has_perm('content.delete') IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR p_id <= 0 THEN
    RAISE EXCEPTION 'invalid post id' USING ERRCODE = '22023';
  END IF;
  IF reason IS NULL OR pg_catalog.char_length(reason) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'reason must contain 5 to 1000 characters' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.posts WHERE id = p_id RETURNING id INTO deleted_id;
  IF deleted_id IS NULL THEN
    RAISE EXCEPTION 'post not found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.admin_audit_write(
    'content.delete', deleted_id::text, jsonb_build_object('reason', reason)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.content_delete_post(bigint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.content_delete_post(bigint,text) TO authenticated;

-- Keep the old signature but fail closed, including calls from other definer RPCs.
CREATE OR REPLACE FUNCTION public.content_delete_post(p_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'deletion requires a reason; refresh the admin page'
    USING ERRCODE = '22023';
END;
$function$;
REVOKE ALL ON FUNCTION public.content_delete_post(bigint) FROM PUBLIC, anon, authenticated;

-- Client DELETE remains available to the author. Moderation uses the audited RPC.
CREATE POLICY kinqsy_posts_client_delete_owner
ON public.posts AS RESTRICTIVE FOR DELETE TO PUBLIC
USING (auth.uid() = user_id);
COMMIT;

