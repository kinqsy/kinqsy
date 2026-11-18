-- ARCHIVE ONLY: applied manually; do not rerun or auto-deploy.
-- KINQSY: repair chat session update guard.
-- Changes a trigger function, not user data. Run as postgres in SQL Editor.
BEGIN;
CREATE OR REPLACE FUNCTION public.chat_block_client_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_a IS DISTINCT FROM OLD.user_a
     OR NEW.user_b IS DISTINCT FROM OLD.user_b THEN
    RAISE EXCEPTION 'chat identity and participants cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.a_seen IS DISTINCT FROM OLD.a_seen
     AND auth.uid() IS DISTINCT FROM OLD.user_a THEN
    RAISE EXCEPTION 'cannot change another participant read marker'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.b_seen IS DISTINCT FROM OLD.b_seen
     AND auth.uid() IS DISTINCT FROM OLD.user_b THEN
    RAISE EXCEPTION 'cannot change another participant read marker'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND coalesce(pg_catalog.current_setting('kq.close_chat', true), '') <> '1' THEN
    RAISE EXCEPTION 'end session only via close_chat'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- Abort rather than silently leave the function unattached or partially scoped.
DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.chat_sessions'::regclass
      AND t.tgfoid = 'public.chat_block_client_end()'::regprocedure
      AND t.tgenabled IN ('O', 'A')
      AND t.tgtype = 19
      AND t.tgattr = ''::int2vector
      AND t.tgqual IS NULL
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Expected unconditional BEFORE UPDATE row trigger missing; transaction rolled back';
  END IF;
END;
$verify$;
COMMIT;

-- Metadata-only verification; no chat rows or messages are returned.
SELECT p.proname, p.prosecdef AS security_definer,
       p.proconfig, pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'chat_block_client_end';
