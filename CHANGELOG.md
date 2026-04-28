# BA Banner Generator — Changelog

---

## v1.6 — 2026-04-28

### New
- **Master Preview Builder** — "⊞ Master Preview" button next to Export opens a dedicated overlay with three ZIP pickers (Casino, Sports, Dual). At least one ZIP is required. The builder reads each exported ZIP, inlines all banner assets as base64 data URIs and generates a single self-contained `master-preview.html` with vertical tabs → funnel tabs → copy code pills. The file can be opened directly in any browser with no extraction or server required.
- **Two output modes** — after export completes, two buttons appear: **⬇ Preview Bundle** (open HTML folders + `preview.html` per copy group, ready for review) and **⬇ Deliverables ZIP** (each banner size as its own `.zip`, structured for ad platform trafficking). Preview ZIP is named by campaign date; Deliverables ZIP is named by vertical (e.g. `Casino.zip`).
- **Campaign type parsing** — section names now encode campaign type: no prefix = `Targeted`, `OR-` prefix = `Organic Retargeting`, `RR-` prefix = `Registered Retargeting` (e.g. `MOF OR-SC`, `BOF RR-500B`). Both output modes use this as the top-level folder.
- **Structured output folders** — both Preview and Deliverables are now organised as `CampaignType / Funnel / CopyCode /` (e.g. `Targeted/TOF/WLM/` or `Organic Retargeting/MOF/SC/`).

### Fixed
- **T&Cs Apply no longer animates** — added to `STATIC_UI_PATTERNS` so it is always forced static regardless of per-frame rendering differences.
- **TOF/MOF/BOF N layers now animate correctly** — trailing number stripped from layer name (e.g. `TOF 1`, `TOF 2` → key `TOF`) so all scene frames are grouped and cross-fade as intended.
- **Banner count on Convert button now accurate** — previously multiplied sections × sizes (over-counting when some sections lack certain sizes); now counts only actual section/size combinations that exist in the file.
- **Master Preview title removed** from the overlay header to save space.
- **"CASINO & SPORTS" / "SPORTS & CASINO"** vertical labels replaced with **"Dual"** in the generated `master-preview.html`.

---

## v1.5 — 2026-04-22

### New
- **Help & Documentation** — `?` button in the header opens a full documentation overlay covering: plugin overview, Figma file structure, Control Panel setup, layer naming rules, step-by-step workflow, video folder setup, output filename anatomy and a link to the Figma template
- **Export Stop button** — hard stop that cancels the export immediately, closes the overlay and re-enables the Convert button
- **Download button** — replaces auto-download; overlay stays open so the full log can be reviewed before saving the ZIP
- **Elapsed timer** — live timer in the export overlay header (e.g. `14s`, `1:23`); final time shown in the done title
- **Accurate progress bar** — driven by real per-banner ticks from Figma processing, not just ZIP packaging speed
- **Progress % label** — shown in the overlay header while exporting

### Improved
- **Funnel badges** recoloured — pink (TOF), blue (MOF), purple (BOF)
- **Preview page titles** now show the vertical name (`Casino`, `Sports`, `Dual`) instead of the raw canonical filename
- **Preview layout** restructured — 728×90 sits below the right block (320×480 + stacked sizes), all top-aligned so 320×480 lines up with 160×600
- **Video Files panel** — native file input hidden, replaced with a styled button; shows filename in green with ✓ and dark green background when loaded; fixed height regardless of filename length
- **Banner sizes section** — reorganised into a 4-column grid; removed the confusing scene count badge
- **Folder / Scan buttons** — unified to the same size and font weight for consistency

### Fixed
- **CTA pulse animation** now correctly applies to TOF and MOF layers, not just BOF
- **T&C Apply** vertically centred on 728×90, 320×50 and 300×50

---

## v1.4 — 2026-03-XX

- Structured master ZIP with folders per funnel and copy code
- Root `preview.html` with tabs per funnel and pills per copy code
- Auto video loading from `optimized-videos/` project folder
- Per-section video file pickers (one per funnel)
- Project folder picker with persistent session handle

---

## v1.3 — 2026-03-XX

- Section-based export (one export pass per Figma Section)
- Section naming convention: `FUNNEL_COPYCODE` (e.g. `TOF_LNY01`)
- Per-section canonical filenames
- Sections panel with funnel badges and copy code pills

---

## v1.2 — 2026-03-XX

- Initial public release
- Per-layer PNG export with hash-based deduplication
- Cross-fade animation between scenes
- CTA pulse animation
- Shadow / gradient composite overlay export
- Video layer detection and MP4 injection
- HTML5 banner output with `preview.html`
