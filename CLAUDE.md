# BA Banner Generator – Root Plugin Instructions

## "New Version" Command

When the user says **"new version"** (or similar: "make a new version", "bump version", "next version", "create new version"):

1. **Detect the latest version** – scan all folders matching `ba-banner-generator-v*` or `ba-banner-generator v*`, find the highest semver (e.g. `v1.5`).
2. **Compute the next version** – increment the minor number by 0.1 (e.g. `v1.5` → `v1.6`).
3. **Duplicate the latest folder** with the new version name (e.g. `ba-banner-generator-v1.6/`).
4. **Update version strings inside the new folder**:
   - `manifest.json` → `"name"` field: `"BA Banner Generator v1.6"`
   - `code.js` → `figma.showUI()` title: `'BA Banner Generator v1.6'`
   - `ui.html` → `.hdr-ver` span: `<span class="hdr-ver">v1.6</span>`
   - `CLAUDE.md` → update any hardcoded version references to the new version.
5. Do all of this **proactively** — no need to ask for confirmation.

## Explicit Version Mention

When the user says something like "I'm working on v1.3", "starting version 2.0", "new version is 1.4":
- Update `manifest.json` `"name"` field, `code.js` title, and `ui.html` `.hdr-ver` span to the version they specified.

## Commit Rule

**Every commit must include updated documentation.** Before committing:
1. Add a new entry (or update the current version entry) in `CHANGELOG.md` listing all changes made in the session.
2. Update `README.md` if any user-facing behaviour changed.
3. Update `CLAUDE.md` (both root and version-specific) if any workflow rules changed.

## Plugin File Map

- `manifest.json` – plugin name, id, api version, entry points
- `code.js` – runs in Figma sandbox (QuickJS / ES6 only — no `??`, no `?.`)
- `ui.html` – plugin UI (self-contained HTML/CSS/JS)
- `icon.svg` – yellow-only BA mark (for future PNG icon conversion)
