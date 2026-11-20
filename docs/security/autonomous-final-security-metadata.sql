-- READ ONLY catalogs/metadata. No user rows or function bodies/secrets.
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
 pg_catalog.has_column_privilege('authenticated',c.oid,'rating','UPDATE') AS can_update_rating,
 pg_catalog.has_column_privilege('authenticated',c.oid,'rating','INSERT') AS can_insert_rating
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='profiles'
 AND EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attname='rating' AND NOT a.attisdropped);
SELECT schemaname,tablename,policyname,cmd,roles,qual,with_check
FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename IN('profiles','reactions','comments','messages','admin_feedback','gossip_reports') ORDER BY tablename,policyname;
SELECT c.relname AS table_name,t.tgname,t.tgenabled,pg_catalog.pg_get_triggerdef(t.oid) AS definition
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname;
SELECT n.nspname AS schema_name,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef,p.proconfig
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname ~* '(rating|reput|spam|rate.?limit|captcha|delete.?account|delete.?user|remove.?account)'
ORDER BY p.proname;
SELECT c.relname AS table_name,k.conname,pg_catalog.pg_get_constraintdef(k.oid) AS definition
FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
WHERE k.contype='f' AND (k.confrelid='auth.users'::regclass OR k.confrelid='public.profiles'::regclass)
ORDER BY c.relname,k.conname;

