# BA Banner Generator – Plugin Instructions (v1.6)

## "New Version" Command

When the user says **"new version"** (or similar: "make a new version", "bump version", "next version", "create new version"):

1. **Detect the latest version** – scan all sibling folders matching `ba-banner-generator-v*` or `ba-banner-generator v*`, find the highest semver (currently `v1.6`).
2. **Compute the next version** – increment the minor number by 0.1 → `v1.7`.
3. **Duplicate this folder** as `ba-banner-generator-v1.7/`.
4. **Update version strings inside the new folder**:
   - `manifest.json` → `"name"` field: `"BA Banner Generator v1.7"`
   - `code.js` → `figma.showUI()` title: `'BA Banner Generator v1.7'`
   - `ui.html` → `.hdr-ver` span: `<span class="hdr-ver">v1.7</span>`
   - `CLAUDE.md` → update version references to `v1.7`.
5. Do all of this **proactively** — no need to ask for confirmation.

## Explicit Version Mention

When the user says something like "I'm working on v1.3", "starting version 2.0", "new version is 1.4", automatically update the version number in **both** of these places before doing anything else:

1. **`code.js`** – the `title` field inside `figma.showUI()`:
   ```js
   figma.showUI(__html__, { width: 480, height: 870, title: 'BA Banner Generator v1.6' });
   ```

2. **`ui.html`** – the `.hdr-ver` span in the header:
   ```html
   <span class="hdr-ver">v1.6</span>
   ```

Replace `v1.6` with the new version number the user specified. Do this proactively — no need to ask for confirmation.

## Plugin File Map
- `manifest.json` – plugin name, id, api version, entry points
- `code.js` – runs in Figma sandbox (QuickJS / ES6 only — no `??`, no `?.`)
- `ui.html` – plugin UI (self-contained HTML/CSS/JS)
- `icon.svg` – yellow-only BA mark (for future PNG icon conversion)

## Key Concepts (v1.6)

### Section naming convention
Sections encode campaign type in their name:
- `TOF WLM` → Targeted, Funnel: TOF, CopyCode: WLM
- `MOF OR-SC` → Organic Retargeting, Funnel: MOF, CopyCode: SC
- `BOF RR-500B` → Registered Retargeting, Funnel: BOF, CopyCode: 500B

### Output folder structure
Both output modes use: `CampaignType / Funnel / CopyCode /`
- Preview Bundle: open HTML folders + `preview.html` per group
- Deliverables ZIP: each size as `canonicalName.zip`, named `[Vertical].zip` (e.g. `Casino.zip`)

### Layer role patterns (code.js)
- `STATIC_UI_PATTERNS` – always static: CTA, Logo, T&Cs Apply
- `SCENE_PATTERNS` – position-keyed, cross-fade: Master (1), Master (2)…
- `OVERLAY_PATTERNS` – composited as one layer: Shadow, Gradient, Rectangle N
- `VIDEO_PATTERNS` – video container detection
- TOF/MOF/BOF N layers (e.g. `TOF 1`, `TOF 2`) – trailing number stripped so all frames share one key and animate correctly
