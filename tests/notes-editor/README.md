# Notes editor browser checks

Run on Windows with Node.js and an existing Google Chrome installation:

```powershell
node tests/notes-editor/run-browser-tests.cjs
```

The fixture loads the actual Notes HTML, shared editor and sticker catalog. Supabase is replaced by a local mock before page scripts run. A Content Security Policy blocks outbound connections and remote images. No production data is read or written and no dependencies are installed.

Checks cover movement persistence, isolated objects, resize, layers, locking, exact coordinates, JSON round trips, published rendering at 360px width, text styling, single catalog insertion, literal catalog text, legacy conversion, complete save receipts, rejected/network writes and local draft recovery. Browser results are written next to the runner. `--preview` also creates a desktop screenshot from synthetic content.

This does not establish live Supabase acceptance, signed media delivery, physical touch behavior, full Dreams parity or player behavior. Those require separate checks/stages.
