-- PROPOSED CHANGE. Do not run in production without approval.
-- Only closes client writes through public.gossip_layouts.
-- Preserves SELECT, can_view_gossip, profiles, posts RLS and Storage.
BEGIN;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.gossip_layouts FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, decor), UPDATE (id, decor), REFERENCES (id, decor)
ON TABLE public.gossip_layouts FROM PUBLIC, anon, authenticated;

-- Abort if inherited or column-level client writes remain.
DO $audit$
DECLARE role_name text; column_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF pg_catalog.has_table_privilege(role_name, 'public.gossip_layouts',
       'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
      RAISE EXCEPTION 'Remaining write privileges for %; inspect inherited grants', role_name;
    END IF;
    FOREACH column_name IN ARRAY ARRAY['id', 'decor'] LOOP
      IF pg_catalog.has_column_privilege(role_name, 'public.gossip_layouts', column_name,
         'INSERT, UPDATE, REFERENCES') THEN
        RAISE EXCEPTION 'Remaining column write privileges for %', role_name;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT pg_catalog.has_table_privilege('authenticated', 'public.gossip_layouts', 'SELECT') THEN
    RAISE EXCEPTION 'Expected authenticated SELECT is missing; change rolled back';
  END IF;
END
$audit$;
COMMIT;
