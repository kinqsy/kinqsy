-- Manual proposal; creates a function, does not submit quotes.
BEGIN;
CREATE OR REPLACE FUNCTION public.submit_quote_suggestion(p_text text, p_author text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  viewer uuid := auth.uid();
  quote_text text := btrim(p_text);
  quote_author text := nullif(btrim(p_author), '');
  saved_id uuid;
BEGIN
  IF viewer IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF quote_text IS NULL OR char_length(quote_text) NOT BETWEEN 1 AND 10000
     OR char_length(coalesce(quote_author, '')) > 300 THEN
    RAISE EXCEPTION 'invalid quote or author length' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.admin_feedback(kind, user_id, text, author, source, status)
  VALUES ('quote', viewer, quote_text, quote_author, 'home', 'new')
  RETURNING id INTO saved_id;
  IF saved_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_feedback f
    WHERE f.id = saved_id AND f.user_id = viewer AND f.kind = 'quote'
  ) THEN
    RAISE EXCEPTION 'quote persistence not confirmed' USING ERRCODE = 'P0001';
  END IF;
  RETURN saved_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_quote_suggestion(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quote_suggestion(text,text) TO authenticated;
COMMIT;
SELECT p.proname AS function_name, p.proconfig AS settings,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_catalog.pg_proc p
WHERE p.oid = 'public.submit_quote_suggestion(text,text)'::regprocedure;

