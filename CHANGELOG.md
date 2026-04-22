# BA Banner Generator — Changelog

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
