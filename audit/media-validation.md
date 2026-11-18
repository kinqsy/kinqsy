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

## Native Chrome browser fixture

Nine assertions passed in a real Chrome DOM with local HTTP Storage stubs and actual KQL editor code: legacy URL signing, image decode, simulated expiry refresh, editor x-coordinate preservation on reopen, upload adds an object, detached Image measurement uses signed URL and correct aspect ratio, persisted decor excludes signing tokens, signout removes src, signin restores image. Initial fixture run failed because its getPublicUrl stub was absent; completed stub and reran to ALL PASSED. Production behavior was not used to satisfy any test. Full-page/live Supabase and mobile end-to-end checks remain unperformed.

A detached image measurement incompatibility was fixed in kinqsy-layout.js; signing/getSession network exceptions now return a denied result rather than an unhandled rejection. The ownerless legacy file was identified by the user as an old test image; it remains stored and will no longer have public read access after activation. No owner reassignment or deletion is included.
