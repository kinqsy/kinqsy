-- Apply in staging before production. Existing profiles and Auth rows are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.kinqsy_create_confirmed_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  nick text := btrim(NEW.raw_user_meta_data ->> 'display_name');
  attempt integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.email_confirmed_at IS NOT NULL THEN RETURN NEW; END IF;
  END IF;
  FOR attempt IN 1..5 LOOP
    IF attempt > 1 OR nick IS NULL OR nick !~ '^[A-Za-z0-9._-]{2,32}$'
       OR lower(nick) IN ('kinqsy','me') THEN
      nick := 'user-' || left(replace(gen_random_uuid()::text, '-', ''), 20);
    END IF;
    BEGIN
      INSERT INTO public.profiles (id, user_id, display_name, friend_code, rating, updated_at)
      VALUES (NEW.id, nick, nick, 'KQ-' || upper(left(gen_random_uuid()::text, 6)), 0, now())
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.kinqsy_create_confirmed_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS kinqsy_create_confirmed_profile ON auth.users;
CREATE TRIGGER kinqsy_create_confirmed_profile
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW WHEN (NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.kinqsy_create_confirmed_profile();
COMMIT;
