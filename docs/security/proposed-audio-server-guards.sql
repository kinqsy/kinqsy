-- PROPOSAL ONLY. Do not apply before reviewing fresh preflight metadata and browser MIME types.
-- No files or tracks are removed. Invalid legacy rows cause a rollback, not automatic repair.
BEGIN;
DO $preflight$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tracks WHERE split_part(path,'/',1) IS DISTINCT FROM user_id::text
   OR bytes IS NULL OR bytes NOT BETWEEN 1 AND 15728640
   OR path !~* '/[^/]+\.(mp3|m4a|ogg|wav|aac)$') THEN
   RAISE EXCEPTION 'Legacy tracks need review; no automatic changes applied';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='user-audio') THEN
   RAISE EXCEPTION 'user-audio bucket missing';
 END IF;
END;
$preflight$;
ALTER TABLE public.tracks ADD CONSTRAINT kinqsy_tracks_owner_path
 CHECK(split_part(path,'/',1)=user_id::text AND path ~* '/[^/]+\.(mp3|m4a|ogg|wav|aac)$');
ALTER TABLE public.tracks ADD CONSTRAINT kinqsy_tracks_bytes
 CHECK(bytes IS NOT NULL AND bytes BETWEEN 1 AND 15728640);
UPDATE storage.buckets SET file_size_limit=15728640,
 allowed_mime_types=ARRAY['audio/mpeg','audio/mp3','audio/mp4','audio/m4a','audio/x-m4a','audio/aac','audio/x-aac','audio/ogg','application/ogg','audio/wav','audio/x-wav','audio/wave','audio/vnd.wave']::text[]
 WHERE id='user-audio';
CREATE POLICY kinqsy_audio_upload_owner ON storage.objects
AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (
 bucket_id<>'user-audio' OR (
 auth.uid() IS NOT NULL AND owner_id=auth.uid()::text
 AND split_part(name,'/',1)=auth.uid()::text
 AND name ~* '/[^/]+\.(mp3|m4a|ogg|wav|aac)$'
 ));
COMMIT;

