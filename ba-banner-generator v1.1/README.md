# BA Banner Generator — Figma Plugin

**Version:** 1.1  
**Plugin ID:** `com.ba.banner-generator`  
**Editor:** Figma (Desktop / Web)

Exports animated HTML display banners directly from a Figma page. Each banner frame is sliced layer-by-layer, cross-fades between scenes, and is packaged as a self-contained ZIP ready for ad serving.

---

## How it works

1. **Scan** — the plugin walks the current Figma page and detects all frames that match a known IAB/BA banner size and follow the `{W}x{H}_…` naming convention.
2. **Export** — each direct child layer is exported as a PNG. Layers that look identical across all scenes are promoted to _static_ (exported once). Layers that differ are treated as _scene_ layers and cross-fade between transitions.
3. **Package** — a ZIP is generated per banner size containing `index.html`, reference PNGs in `assets/`, optional video in `videos/`, and a `layout.json` manifest.

---

## Supported banner sizes

| Width | Height |
|-------|--------|
| 728 | 90 |
| 600 | 160 / 120 |
| 468 | 60 |
| 320 | 480 / 50 |
| 300 | 600 / 300 / 250 / 50 |
| 250 | 250 |
| 160 | 600 |

---

## Figma file setup

### Banner frame naming

Frames must be named with their pixel dimensions as the first token:

```
300x250_TOP_LNY01
728x90_MID_500WB
```

The pattern is `{W}x{H}` (or `{W}×{H}`) followed by any separator (`_`, `-`, space).

### Layer naming conventions

| Layer name | Role | Behaviour in banner |
|---|---|---|
| `BA_Logo`, `logo*` | Static logo | Always visible, no animation |
| `CTA`, `cta*` | Static CTA | Always visible, `ctaPulse` scale animation |
| `CTA + Logo` | Combined group | Expanded — logo and CTA become independent layers |
| `Master (N)`, `master*` | Scene layer | Cross-fades between scenes |
| `*.webm`, `*video*` | Video container | Replaced by `<video>` tag; poster PNG extracted from Figma |
| Everything else | Background/scene | Hash-compared; static if identical across all scenes |

> **Important:** Any layer whose artwork bleeds outside the artboard (e.g. a keyart) must be a **Frame** the same size as the artboard with **Clip Content ON**. The plugin will then export the correct W×H PNG.

### Sections (Copy Code workflow)

Place banner frames inside **Figma Sections** to export multiple copy codes in one pass.

Section names follow the pattern `FUNNEL - CopyCode`:

```
TOP - LNY01
MID - 500WB
BOT - 40FS
```

Recognised funnels: `TOP`, `MID`, `BOT` (anything else is tagged `XX`).

When sections are detected the plugin shows a **Sections** panel where individual copy codes can be checked/unchecked before export. Each section produces its own ZIP.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| Click URL | `https://betanything.eu` | `window.open()` target when the banner is clicked |
| Scene duration | `2200 ms` | How long each scene is fully visible |
| Fade time | `400 ms` | CSS cross-dissolve duration between scenes |
| Export scale | `1×` | PNG export multiplier (1 = 1 CSS px : 1 device px) |
| Video (.mp4) | — | Optional MP4 to embed in banners with a video layer |

---

## File naming convention

Exported ZIPs follow the naming scheme:

```
{Brand}_{Year}_{Vertical}_{Campaign}_{Funnel}_{CopyCode}_{Channel}_{Type}_{Date}_{Size}.zip
```

**Example:**
```
BA_2026_C_W3_TOP_LNY01_DISPLAY_DYN_20260319_300x250.zip
```

| Token | Editable | Notes |
|---|---|---|
| Brand | Fixed | Always `BA` |
| Year | Yes | 4-digit year |
| Vertical | Yes | e.g. `C` for Casino |
| Campaign | Yes | e.g. `W3` |
| Funnel | Yes / auto | Overridden by section funnel when using sections |
| CopyCode | Yes / auto | Overridden by section copy code when using sections |
| Channel | Fixed | Always `DISPLAY` |
| Type | Fixed | Always `DYN` |
| Date | Auto-filled | Today's date in `YYYYMMDD` |

---

## Video layer support

Banners with a **VIDEO fill** in Figma are detected automatically. Because the Figma plugin API does not expose the raw video bytes, the MP4 must be supplied manually:

- **Flat mode (no sections):** use the single _Video (.mp4)_ picker in Settings.
- **Section mode:** a per-funnel video picker appears in the _Video Files_ panel — one MP4 is shared across all copy codes in the same funnel.

The video poster image (Figma's thumbnail frame) is extracted automatically and saved as `images/video_poster.png` inside the ZIP.

---

## Output ZIP contents

```
BA_2026_C_W3_TOP_LNY01_DISPLAY_DYN_20260319_300x250.zip
└── BA_2026_C_W3_TOP_LNY01_DISPLAY_DYN_20260319_300x250/
    ├── index.html          ← self-contained animated banner
    ├── layout.json         ← layer manifest (QA / tooling)
    ├── assets/
    │   ├── Background.png
    │   ├── CTA.png
    │   ├── BA_Logo.png
    │   └── Master_scene_01.png, Master_scene_02.png, …
    ├── images/
    │   └── video_poster.png   (only if video layer present)
    └── videos/
        └── video_300x250.mp4  (only if MP4 was supplied)
```

---

## Changelog

### v1.1

- **Purple UI theme** — full dark-purple colour scheme with CSS custom properties; consistent with the BetAnything design system.
- **Version badge** — `v1.1` label displayed in the plugin header.
- **Fuzzy-persistent layer detection** — layers whose position drifts ≤ 6 px across scenes (Figma rendering noise on gradients/glows) are automatically promoted to static or managed with `data-layers` opacity, eliminating cross-fade flicker on overlay layers.
- **Gradient instant-cut** — scene layers below the topmost animated layer receive `transition:none` (`.sc-g` class) so gradient/overlay layers cut atomically, preventing the video layer from showing through during transitions.
- **Video layer by content** — video containers are now matched by the presence of a `VIDEO` fill type rather than by name, so scene groups renamed `Master (1)`, `Master (2)` … are correctly identified on every frame.
- **Section-mode per-funnel video pickers** — when sections are present, a dedicated MP4 picker appears for each unique funnel instead of a single global picker.
- **Base64-safe postMessage** — PNG bytes are encoded to base64 strings in the plugin sandbox before `postMessage`, avoiding the Figma `deepUnwrap` WASM abort on large byte arrays.
- **Hidden-layer warning** — layers hidden in frame 1 emit a console warning instead of silently producing a broken export.
- **"Download All" master ZIP** — after export, a single button packages all individual ZIPs into one master ZIP named with `MULTI` funnel/copy tokens.

### v1.0

- Initial release: multi-scene PNG export, cross-fade animation, IAB size detection, JSZip packaging, file naming convention.
