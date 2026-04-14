# BA Banner Generator – Plugin Instructions

## Version Updates
Whenever the user mentions they are working on a new version (e.g. "I'm working on v1.3", "starting version 2.0", "new version is 1.4", etc.), automatically update the version number in **both** of these places before doing anything else:

1. **`code.js`** – the `title` field inside `figma.showUI()`:
   ```js
   figma.showUI(__html__, { width: 480, height: 870, title: 'BA Banner Generator v1.2' });
   ```

2. **`ui.html`** – the `.hdr-ver` span in the header:
   ```html
   <span class="hdr-ver">v1.2</span>
   ```

Replace `v1.2` with the new version number the user specified. Do this proactively — no need to ask for confirmation.

## Plugin File Map
- `manifest.json` – plugin name, id, api version, entry points
- `code.js` – runs in Figma sandbox (QuickJS / ES6 only — no `??`, no `?.`)
- `ui.html` – plugin UI (self-contained HTML/CSS/JS)
- `icon.svg` – yellow-only BA mark (for future PNG icon conversion)
