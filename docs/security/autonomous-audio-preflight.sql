-- READ ONLY. Aggregate preparation; does not execute application functions.
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='user-audio';
SELECT coalesce(metadata->>'mimetype','unknown') AS mime_type,count(*) AS files,
 max(CASE WHEN metadata->>'size' ~ '^[0-9]+$' THEN (metadata->>'size')::numeric ELSE NULL END) AS maximum_bytes
FROM storage.objects WHERE bucket_id='user-audio' GROUP BY 1 ORDER BY 1;
SELECT count(*) AS tracks,
 count(*) FILTER(WHERE split_part(path,'/',1) IS DISTINCT FROM user_id::text) AS paths_outside_owner_folder,
 count(*) FILTER(WHERE bytes IS NULL OR bytes<1 OR bytes>15728640) AS missing_or_out_of_range_sizes
FROM public.tracks;
-- Before enabling a path/size constraint, review these aggregates and existing data.

