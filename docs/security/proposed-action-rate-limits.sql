-- MANUAL PROPOSAL. Creates counters/triggers; no existing content is rewritten.
-- Agreed limits: posts 5/min, comments 20/min, messages 60/min, reports 10/hour, feedback 10/hour.
BEGIN;
CREATE SCHEMA kinqsy_private;
REVOKE ALL ON SCHEMA kinqsy_private FROM PUBLIC,anon,authenticated;
CREATE TABLE kinqsy_private.action_limits(action text PRIMARY KEY,max_events integer NOT NULL CHECK(max_events>0),window_seconds integer NOT NULL CHECK(window_seconds>0));
INSERT INTO kinqsy_private.action_limits VALUES('posts',5,60),('comments',20,60),('messages',60,60),('reports',10,3600),('feedback',10,3600);
CREATE TABLE kinqsy_private.action_events(actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,action text NOT NULL REFERENCES kinqsy_private.action_limits(action),occurred_at timestamptz NOT NULL);
CREATE INDEX action_events_lookup ON kinqsy_private.action_events(actor_id,action,occurred_at);
ALTER TABLE kinqsy_private.action_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kinqsy_private.action_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA kinqsy_private FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.kinqsy_enforce_action_rate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $function$
DECLARE actor uuid:=auth.uid(); kind text:=TG_ARGV[0]; ceiling integer; seconds integer;
  moment timestamptz; earliest timestamptz; used bigint; retry integer;
BEGIN
 IF actor IS NULL THEN RETURN NEW; END IF;
 IF current_setting('transaction_isolation') <> 'read committed' THEN
   RAISE EXCEPTION 'action rate checks require read committed isolation' USING ERRCODE='25000';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kinqsy.rate:'||actor::text||':'||kind,0));
 SELECT max_events,window_seconds INTO STRICT ceiling,seconds FROM kinqsy_private.action_limits WHERE action=kind;
 moment:=clock_timestamp();
 DELETE FROM kinqsy_private.action_events WHERE actor_id=actor AND action=kind AND occurred_at<=moment-make_interval(secs=>seconds);
 SELECT count(*),min(occurred_at) INTO used,earliest FROM kinqsy_private.action_events WHERE actor_id=actor AND action=kind;
 IF used>=ceiling THEN
   retry:=greatest(1,ceil(extract(epoch FROM earliest+make_interval(secs=>seconds)-moment))::integer);
   RAISE EXCEPTION 'Слишком часто. Повтори через % с.',retry
     USING ERRCODE='P0001',DETAIL='KINQSY_RATE_LIMIT',HINT='retry_after_seconds='||retry::text;
 END IF;
 INSERT INTO kinqsy_private.action_events VALUES(actor,kind,moment);
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.kinqsy_enforce_action_rate() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER kinqsy_posts_rate AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.kinqsy_enforce_action_rate('posts');
CREATE TRIGGER kinqsy_comments_rate AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.kinqsy_enforce_action_rate('comments');
CREATE TRIGGER kinqsy_messages_rate AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.kinqsy_enforce_action_rate('messages');
CREATE TRIGGER kinqsy_reports_rate AFTER INSERT ON public.gossip_reports FOR EACH ROW EXECUTE FUNCTION public.kinqsy_enforce_action_rate('reports');
CREATE TRIGGER kinqsy_feedback_rate AFTER INSERT ON public.admin_feedback FOR EACH ROW EXECUTE FUNCTION public.kinqsy_enforce_action_rate('feedback');
COMMIT;
SELECT c.relname AS table_name,t.tgname,t.tgenabled FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
WHERE t.tgfoid='public.kinqsy_enforce_action_rate()'::regprocedure ORDER BY c.relname;

