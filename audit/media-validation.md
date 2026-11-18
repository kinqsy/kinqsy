# Media validation

Proposed prepare-media-policies.sql was executed successfully on isolated PostgreSQL 16 with synthetic auth.uid(), posts and Storage tables. Application visibility helpers were stubs to isolate the policy boundary; this does not validate production can_view/can_view_gossip implementations or Storage HTTP behavior.

Checks passed under actual authenticated/anon roles and RLS:
- Owner reads all owned files, including unreferenced drafts.
- Authorized reader reads Notes media.
- Authenticated reader reads permitted Gossip media nested in decor.
- Private Dreams file is excluded.
- Referencing a victim's file from another user's Gossip does not grant access.
- Guest reads no media.
- Upload into a foreign folder is rejected; own folder and owner are accepted.

Helper unit checks passed separately; browser DOM lifecycle, uploads through Supabase Storage HTTP, legacy encoded references, and long-lived page refresh still require integration testing. Do not apply the SQL or close the public bucket based solely on these checks. The single ownerless legacy object remains unresolved; no files have been reassigned or removed. Production remains unchanged.
