-- ARCHIVE ONLY: applied manually; do not rerun or auto-deploy.
-- Historical record: already applied manually. Rerunning raises duplicate membership errors.
BEGIN;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.chat_sessions;
COMMIT;
