-- ARCHIVE ONLY: applied manually; do not rerun or auto-deploy.
-- Friendship guard applied manually; retained here as a historical record.
-- Global transaction lock intentionally serializes friendship changes for now.
-- READ COMMITTED required: after waiting, validation must see committed changes.
BEGIN;
LOCK TABLE public.friendships IN SHARE ROW EXCLUSIVE MODE;
CREATE OR REPLACE FUNCTION public.kinqsy_friendship_write_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'friendship changes require read committed isolation';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(18742026, 5);
  RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION public.kinqsy_friendship_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE viewer uuid := auth.uid(); total_a bigint; total_b bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
       OR NEW.addressee_id IS DISTINCT FROM OLD.addressee_id THEN
      RAISE EXCEPTION 'friendship identity cannot be changed' USING ERRCODE='42501';
    END IF;
  END IF;
  IF viewer IS NULL OR viewer NOT IN (NEW.requester_id, NEW.addressee_id) THEN
    RAISE EXCEPTION 'not a friendship participant' USING ERRCODE='42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF viewer IS DISTINCT FROM NEW.requester_id OR NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'create only your own pending request' USING ERRCODE='42501';
    END IF;
  ELSIF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    IF OLD.status IS DISTINCT FROM 'pending' OR viewer IS DISTINCT FROM OLD.addressee_id THEN
      RAISE EXCEPTION 'only addressee can accept a pending request' USING ERRCODE='42501';
    END IF;
    SELECT count(*) INTO total_a FROM public.friendships f
      WHERE f.status='accepted' AND NEW.requester_id IN (f.requester_id,f.addressee_id);
    SELECT count(*) INTO total_b FROM public.friendships f
      WHERE f.status='accepted' AND NEW.addressee_id IN (f.requester_id,f.addressee_id);
    IF total_a >= 5 OR total_b >= 5 THEN
      RAISE EXCEPTION 'maximum five friends per user' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE UNIQUE INDEX IF NOT EXISTS friendships_unordered_pair_uidx
ON public.friendships (least(requester_id,addressee_id), greatest(requester_id,addressee_id));
CREATE TRIGGER kinqsy_friendship_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.friendships
FOR EACH STATEMENT EXECUTE FUNCTION public.kinqsy_friendship_write_lock();
CREATE TRIGGER kinqsy_friendship_guard
BEFORE INSERT OR UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.kinqsy_friendship_guard();
COMMIT;
