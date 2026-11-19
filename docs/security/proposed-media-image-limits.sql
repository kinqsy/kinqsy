-- Manual proposal: changes bucket settings only; existing objects are not removed.
BEGIN;
UPDATE storage.buckets
SET file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp']::text[]
WHERE id = 'media';
COMMIT;
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'media';
