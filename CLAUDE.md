# BA Banner Generator – Plugin Instructions (v1.5)

## "New Version" Command

When the user says **"new version"** (or similar: "make a new version", "bump version", "next version", "create new version"):

1. **Detect the latest version** – scan all sibling folders matching `ba-banner-generator-v*` or `ba-banner-generator v*`, find the highest semver (currently `v1.5`).
2. **Compute the next version** – increment the minor number by 0.1 → `v1.6`.
3. **Duplicate this folder** as `ba-banner-generator-v1.6/`.
4. **Update version strings inside the new folder**:
   - `manifest.json` → `"name"` field: `"BA Banner Generator v1.6"`
   - `code.js` → `figma.showUI()` title: `'BA Banner Generator v1.6'`
   - `ui.html` → `.hdr-ver` span: `<span class="hdr-ver">v1.6</span>`
   - `CLAUDE.md` → update version references to `v1.6`.
5. Do all of this **proactively** — no need to ask for confirmation.

## Explicit Version Mention

When the user says something like "I'm working on v1.3", "starting version 2.0", "new version is 1.4", automatically update the version number in **both** of these places before doing anything else:

1. **`code.js`** – the `title` field inside `figma.showUI()`:
   ```js
   figma.showUI(__html__, { width: 480, height: 870, title: 'BA Banner Generator v1.5' });
   ```

2. **`ui.html`** – the `.hdr-ver` span in the header:
   ```html
   <span class="hdr-ver">v1.5</span>
   ```

Replace `v1.5` with the new version number the user specified. Do this proactively — no need to ask for confirmation.

## Plugin File Map
- `manifest.json` – plugin name, id, api version, entry points
- `code.js` – runs in Figma sandbox (QuickJS / ES6 only — no `??`, no `?.`)
- `ui.html` – plugin UI (self-contained HTML/CSS/JS)
- `icon.svg` – yellow-only BA mark (for future PNG icon conversion)
