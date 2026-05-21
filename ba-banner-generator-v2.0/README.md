# BA Banner Generator v2.0

Figma plugin that converts banner frames into production-ready HTML5 animated banners.

## Quick workflow

1. **Scan** — click Scan to read the Figma page (banner frames, sections, Control Panel)
2. **Sizes** — choose which sizes to export (all checked by default)
3. **Video** — if banners use a video layer, load the MP4 per funnel from the Video Files panel
4. **Settings** — set click URL, scene duration, fade time, date
5. **Convert** — click "Convert HTML5 Banners"; a progress overlay with live timer starts
6. **Download** — when done, two buttons appear:
   - **⬇ Preview Bundle** — open HTML folders + `preview.html` per copy group (for review)
   - **⬇ Deliverables ZIP** — each banner size as its own `.zip` (for ad platform trafficking)

## Section naming convention

Sections encode campaign type directly in their name:

| Section name | Campaign type | Funnel | Copy code |
|---|---|---|---|
| `TOF WLM` | Targeted | TOF | WLM |
| `MOF OR-SC` | Organic Retargeting | MOF | SC |
| `BOF RR-500B` | Registered Retargeting | BOF | 500B |

No prefix = Targeted · `OR-` prefix = Organic Retargeting · `RR-` prefix = Registered Retargeting

## Output folder structure

Both output modes are structured as:

```
CampaignType / Funnel / CopyCode / banner-files
```

Example: `Targeted/TOF/WLM/` · `Organic Retargeting/MOF/SC/`

The Deliverables ZIP is named after the vertical (e.g. `Casino.zip`, `Sports.zip`, `Dual.zip`).

## Layer naming rules

| Layer name | Role |
|---|---|
| `Master (1)`, `Master (2)`… | Scene background — cross-fades between scenes |
| `TOF 1`, `TOF 2`… / `MOF 1`… / `BOF 1`… | Offer copy — animates across scenes |
| `CTA TOF` / `CTA MOF` / `CTA BOF` | CTA button — always visible, pulse animation |
| `CTA + Logo` | Expanded into Logo + CTA sub-layers |
| `BA_Logo…` / `Logo…` | Logo — always visible, no animation |
| `T&Cs Apply` | Legal disclaimer — always static |
| `Shadow…` / `Gradient…` / `Rectangle N` | Overlay — composited as one layer |
| `Video` | Video container — replaced with MP4 |

Layer names are case-insensitive.

## Control Panel (Figma)

A Section named `Control Panel` on the page can contain TEXT layers:

| Layer name | Value | Example |
|---|---|---|
| `vertical` | Vertical code | `C` Casino · `S` Sports · `CS` Dual |
| `campaign` | Campaign short code | `W4` · `LNY` |

## Master Preview Builder

After export, the **⊞ Master Preview** button opens a builder where you can select up to three ZIPs (Casino, Sports, Dual). It generates a single self-contained `master-preview.html` with vertical tabs → funnel tabs → copy code pills. Open it directly in any browser — no server needed.

## Banner sizes

| Frame name | Size |
|---|---|
| `300x600` | Half Page |
| `160x600` | Wide Skyscraper |
| `320x480` | Interstitial |
| `300x250` | MPU |
| `728x90` | Leaderboard |
| `320x50` | Mobile Banner |
| `300x50` | Mobile Banner |

## Video file setup

For auto-loading, organise your project folder as:

```
my-campaign/
  optimized-videos/
    casino/
      casino-tof-optimized.mp4
      casino-mof-optimized.mp4
      casino-bof-optimized.mp4
```

The subfolder must match the vertical name. Each file must contain `TOF`, `MOF` or `BOF` in its filename.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
