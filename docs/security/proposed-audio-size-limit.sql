-- Manual proposal; merging does not apply this SQL. Existing objects are not removed.
BEGIN;
UPDATE storage.buckets SET file_size_limit = 15728640 WHERE id = 'user-audio';
COMMIT;
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'user-audio';
