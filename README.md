# BA Banner Generator v1.6

Figma plugin that converts banner frames into production-ready HTML5 animated banners.

## What it does
- Scans the current Figma page for banner frames organised by size (`300x250`, `728x90`, etc.)
- Exports each layer as a PNG and builds an animated HTML5 banner that cross-fades between scenes
- Supports Figma Sections for multi-funnel / multi-copy exports
- Packages output as a structured ZIP ready for review or trafficking

## Output modes
| Mode | Contents | Filename |
|---|---|---|
| Preview Bundle | Open HTML folders + `preview.html` per copy group | `BA_YYYY_V_CAMPAIGN_DATE_PREVIEW.zip` |
| Deliverables ZIP | Each banner size as its own `.zip` | `[Vertical].zip` (e.g. `Casino.zip`) |

Both are structured as `CampaignType / Funnel / CopyCode /`.

## Section naming convention
| Section name | Campaign Type | Funnel | Copy Code |
|---|---|---|---|
| `TOF WLM` | Targeted | TOF | WLM |
| `MOF OR-SC` | Organic Retargeting | MOF | SC |
| `BOF RR-500B` | Registered Retargeting | BOF | 500B |

## Layer naming rules
| Layer name | Role |
|---|---|
| `Master (1)`, `Master (2)`… | Scene background — cross-fades between scenes |
| `TOF 1`, `TOF 2`… / `MOF 1`… / `BOF 1`… | Offer copy — animates across scenes |
| `CTA TOF` / `CTA MOF` / `CTA BOF` | CTA button — always visible, pulse animation |
| `CTA + Logo` | Expanded into Logo + CTA sub-layers |
| `BA_Logo…` / `Logo…` | Logo — always visible, no animation |
| `T&Cs Apply` | Disclaimer — always static |
| `Shadow…` / `Gradient…` / `Rectangle N` | Overlay — composited as one layer |
| `Video` | Video container |

## Control Panel (Figma)
A Section named `Control Panel` on the page can contain TEXT layers:
- `vertical` — vertical code (`C`, `S`, `D`, `CS`)
- `campaign` — campaign short code (e.g. `W4`, `LNY`)

## Changelog
See [CHANGELOG.md](CHANGELOG.md).
