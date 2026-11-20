-- READ ONLY: one JSON result, catalogs only, no user data, function bodies or trigger arguments.
SELECT jsonb_pretty(jsonb_build_object(
 'relations',(
  SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity))
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN('public','kinqsy_private') AND c.relkind IN('r','p')
 ),
 'columns',(
  SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'column',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull))
  FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN('public','kinqsy_private') AND c.relkind IN('r','p') AND a.attnum>0 AND NOT a.attisdropped
 ),
 'foreign_keys',(
  SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,'definition',pg_catalog.pg_get_constraintdef(k.oid),'validated',k.convalidated))
  FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN('public','kinqsy_private') AND k.contype='f'
 ),
 'triggers',(
  SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'trigger',t.tgname,'enabled',t.tgenabled,'function_schema',pn.nspname,'function',p.proname))
  FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
  WHERE n.nspname IN('public','kinqsy_private') AND NOT t.tgisinternal
 ),
 'possible_deletion_functions',(
  SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),'security_definer',p.prosecdef))
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f' AND p.proname ~* '(delete.*(account|user|profile)|remove.*(account|user|profile)|erase|anonym)'
 )
)) AS account_deletion_map;

