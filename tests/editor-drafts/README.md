# Local diary drafts

Run on Windows with Node.js and an existing Google Chrome installation:

```powershell
node tests/editor-drafts/run-draft-tests.cjs
node tests/editor-drafts/run-draft-tests.cjs --preview
```

The fixture serves the real Notes and Dreams templates and scripts, with real browser IndexedDB. Authentication and publication are mocked, and outbound application connections are blocked by CSP. The runner uses a fresh headless Chrome profile and ordinary browser time through the Chrome debugging protocol; virtual-time dump-dom is unreliable for IndexedDB and page reloads. No dependencies are installed and no production data is accessed or changed.

38 assertions cover panel independence, original drag/resize behavior, complete manual snapshots, stable IDs and timestamps, separate emergency autosave, compatible legacy session import, real page reloads of both editors, account and section isolation, revision conflicts, atomic concurrent writes, delayed/failed storage, safe close, in-page delete confirmation, and failed/successful ordinary publication.

`--preview` creates editor-panels.png, editor-appearance.png, draft-list.png and mobile screenshots from synthetic records. Local snapshots store canonical media references, not offline copies of image files. Real Supabase acceptance, signed media delivery and physical mobile devices need separate validation.

Storage: IndexedDB `kinqsy-editor-drafts`, version 1, stores `manual`, `recovery`, and `imports`; documents are keyed by owner/section/id. Manual updates compare revisions in a read-write transaction. Emergency snapshots use independent workspace IDs. Legacy `kinqsy:notes:draft:<owner>:<post-or-new>` session entries are read and retained; additive import remembers source fingerprints.

Cloud storage is not enabled. See docs/local-drafts-cloud-proposal.txt for the proposed schema, RLS and future server revision protocol.
