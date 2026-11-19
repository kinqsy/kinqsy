-- Manual proposal. Defines a read-only public projection; publishes no existing suggestions.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_home_quotes()
RETURNS TABLE(id uuid, quote_text text, quote_author text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT f.id, f.text, f.author
  FROM public.admin_feedback AS f
  WHERE f.kind = 'quote' AND f.status = 'published'
    AND char_length(btrim(f.text)) BETWEEN 1 AND 10000
  ORDER BY f.updated_at DESC, f.id
  LIMIT 100;
$function$;
REVOKE ALL ON FUNCTION public.get_home_quotes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_quotes() TO anon, authenticated;
COMMIT;

SELECT p.proname AS function_name, p.proconfig AS settings,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_catalog.pg_proc p WHERE p.oid = 'public.get_home_quotes()'::regprocedure;

