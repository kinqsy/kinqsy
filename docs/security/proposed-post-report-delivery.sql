-- Manual proposal. Metadata/function changes only; does not submit reports or change posts.
BEGIN;
GRANT SELECT ON public.gossip_reports, public.admin_feedback TO authenticated;
GRANT INSERT (post_id, user_id, reason, note) ON public.gossip_reports TO authenticated;
GRANT INSERT (kind, user_id, text, author, source, url) ON public.admin_feedback TO authenticated;
CREATE OR REPLACE FUNCTION public.kinqsy_can_report_post(pid bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.posts p WHERE p.id = $1 AND (
      (p.category = 'gossip' AND public.can_view_gossip(p)) OR
      (p.category IS DISTINCT FROM 'gossip' AND public.can_view(p.user_id, public.post_section(p.category)))
    )
  );
$function$;
REVOKE ALL ON FUNCTION public.kinqsy_can_report_post(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kinqsy_can_report_post(bigint) TO authenticated;

-- Extend the existing restrictive visibility check; do not weaken posts RLS.
ALTER POLICY kinqsy_reports_gossip_only ON public.gossip_reports
  WITH CHECK (public.kinqsy_can_report_post(post_id));
ALTER POLICY kinqsy_reports_gossip_only ON public.gossip_reports
  RENAME TO kinqsy_reports_visible_post;

CREATE POLICY kinqsy_report_initial_fields ON public.gossip_reports
AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND status = 'new' AND target_type = 'post'
  AND assignee_id IS NULL AND staff_note IS NULL
  AND (note IS NULL OR char_length(note) <= 1000)
);

CREATE POLICY kinqsy_feedback_initial_fields ON public.admin_feedback
AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND status = 'new' AND assignee_id IS NULL AND note IS NULL
  AND char_length(btrim(text)) BETWEEN 1 AND 10000
  AND (author IS NULL OR char_length(author) <= 300)
);

CREATE OR REPLACE FUNCTION public.report_context(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE r public.gossip_reports%ROWTYPE; p public.posts%ROWTYPE;
BEGIN
  IF public.has_perm('reports.read') IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.gossip_reports WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public.posts WHERE id = r.post_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'report_id', r.id, 'reason', r.reason, 'note', r.note, 'status', r.status,
    'post_id', p.id, 'title', p.title, 'category', p.category,
    'excerpt', left(coalesce(p.content, ''), 280),
    'author_mode', p.author_mode,
    'author_alias', CASE WHEN p.category = 'gossip' AND p.author_mode = 'alias' THEN p.author_alias ELSE NULL END
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.report_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_context(uuid) TO authenticated;
COMMIT;

SELECT tablename, policyname, permissive, cmd, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public' AND policyname IN (
  'kinqsy_reports_visible_post', 'kinqsy_report_initial_fields', 'kinqsy_feedback_initial_fields'
)
ORDER BY tablename, policyname;

