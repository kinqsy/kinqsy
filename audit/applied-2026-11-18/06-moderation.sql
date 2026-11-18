-- ARCHIVE ONLY: applied manually; do not rerun or auto-deploy.
-- KINQSY: protect Gossip moderation context and internal audit writer.
-- No user data is updated or deleted by this migration.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.admin_audit_write(text,text,jsonb)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.report_context(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  r public.gossip_reports%ROWTYPE;
  p public.posts%ROWTYPE;
BEGIN
  IF public.has_perm('reports.read') IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.gossip_reports WHERE id = p_id;
  IF r.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.posts
  WHERE id = r.post_id AND category = 'gossip';
  IF p.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'report_id', r.id,
    'reason', r.reason,
    'note', r.note,
    'status', r.status,
    'post_id', p.id,
    'title', p.title,
    'category', p.category,
    'excerpt', left(coalesce(p.content, ''), 280),
    'author_mode', p.author_mode,
    'author_alias', CASE WHEN p.author_mode = 'alias' THEN p.author_alias ELSE NULL END
  );
END;
$function$;

-- Keep the existing permissive author check; add a restrictive category check.
-- A moderator still needs reports.read to obtain context through the RPC.
CREATE POLICY kinqsy_reports_gossip_only
ON public.gossip_reports AS RESTRICTIVE
FOR INSERT TO PUBLIC
WITH CHECK (public.can_view_gossip_id(post_id));

DO $verify$
BEGIN
  IF pg_catalog.has_function_privilege('anon',
    'public.admin_audit_write(text,text,jsonb)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated',
    'public.admin_audit_write(text,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'client audit EXECUTE remains; inspect inherited privileges';
  END IF;
END;
$verify$;
COMMIT;

SELECT role_name, pg_catalog.has_function_privilege(
  role_name, 'public.admin_audit_write(text,text,jsonb)', 'EXECUTE'
) AS can_call_audit_writer
FROM (VALUES ('anon'::text), ('authenticated'::text)) AS roles(role_name);

