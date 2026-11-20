-- Manual proposal. Current ratings are not rewritten; browser API roles cannot set reputation.
BEGIN;
CREATE OR REPLACE FUNCTION public.kinqsy_guard_profile_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog
AS $function$
BEGIN
 IF current_user IN ('anon','authenticated') THEN
   IF TG_OP='INSERT' THEN
     IF NEW.rating IS DISTINCT FROM 0::numeric THEN
       RAISE EXCEPTION 'reputation is managed by the server' USING ERRCODE='42501';
     END IF;
   ELSIF NEW.rating IS DISTINCT FROM OLD.rating THEN
     RAISE EXCEPTION 'reputation is managed by the server' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.kinqsy_guard_profile_rating() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER kinqsy_guard_profile_rating
BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW
EXECUTE FUNCTION public.kinqsy_guard_profile_rating();
COMMIT;
SELECT tgname AS trigger_name,tgenabled AS enabled,pg_catalog.pg_get_triggerdef(oid) AS definition
FROM pg_catalog.pg_trigger WHERE tgrelid='public.profiles'::regclass AND tgname='kinqsy_guard_profile_rating';

