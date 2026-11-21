# Editor and vinyl UX checks

Requires existing Windows Google Chrome and Node.js. No dependencies are installed.

```powershell
node tests/notes-editor/run-browser-tests.cjs
node tests/editor-ux/run-dreams-tests.cjs
node tests/editor-ux/run-player-tests.cjs
node tests/editor-ux/check-mobile.cjs player
```

The tests serve local copies of the real templates and scripts, replace Supabase with mocks, and block outbound connections using CSP. They never write production data. The mobile check uses an isolated headless Chrome profile and the Chrome debugging protocol at 390px, then verifies visibility after resizing to 320px. It supplies a browser touch to activate the iframe comment field; synthetic pointer events exercise dragging. Audio playback is stubbed, so these checks do not establish real audio delivery or playback.

Coverage: short/long Notes, ASCII and lower objects, legacy v3/default and explicit height, pre-v3 board CSS, collapsed/expanded tools, JSON reopening and mocked saves; shared Dreams preview/reopening/submission; vinyl mouse/touch-event gestures, cancellation, viewport clamping, actual page reload, position reset, iframe modal/comment docking, retained audio element during iframe navigation and separate Play action.

Old generated `height: 70` uses automatic published sizing; other old height values are preserved. Explicit sizing is stored as `heightMode: fixed`. Reading a post never rewrites its decor. Live Supabase, actual uploads, physical touch devices and full playback/navigation require separate checks.
