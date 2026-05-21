# Session Handoff — BA Banner Generator v2.0

Last updated: 2026-05-08

---

## What was done this session

### 1. General logo cleanup (all base templates)
- All 7 base templates in `templates/` now use the **General logo** (132×28, BetAnything wordmark only — no Casino text)
- CSS `.logo { height: 28px }` confirmed correct in all files
- HTML comments updated from `BA Casino logo (132×35)` → `BA General logo (132×28)` in all files

### 2. "Up To" banner set created
New folder: `templates/up to banners/`  
Contains 7 files + 1 preview page:

```
templates/up to banners/
  300x600.html
  160x600.html
  320x480.html
  300x250.html
  728x90.html
  320x50.html
  300x50.html
  preview.html
```

**Assets path** inside these files: `../../Assets/` (two levels up from subfolder)

#### Copy structure — "Up To" banners
The copy block replaces the rotating copy-1/copy-2 with a **static single block**:

```html
<div class="copy-container">
  <div class="copy">
    <p><span class="copy-gold">100%</span><span class="copy-white"> Bonus</span></p>
    <div class="upto-row">
      <span class="copy-white copy-upto-label">UP TO</span>
      <span class="copy-gold copy-upto-amount">$500</span>
    </div>
  </div>
</div>
```

#### Key CSS technique — "UP TO" wrap (mirrors Figma node 59:582)
Figma uses a **fixed width of 59px at 44px font** on the "UP TO" text — this forces natural word-wrap so "UP" sits on line 1 and "TO" drops to line 2. No `<br>` tag.

```css
.upto-row {
  display: flex;
  align-items: flex-start; /* $500 anchors to top of row */
  gap: Xpx;
}
.copy-upto-label {
  font-size: Ypx;
  line-height: 0.95;
  text-transform: uppercase;
  letter-spacing: 0.44px;
  width: Zpx;   /* fixed width forces UP/TO word-wrap */
  flex-shrink: 0;
  /* NO word-break: break-word — causes letter-level breaks */
}
.copy-upto-amount {
  font-size: [large]px;
  line-height: 1;
  white-space: nowrap;
}
```

#### Per-banner label widths (calibrated so "UP" fits, "UP TO" wraps)

| File        | Label font | Width |
|-------------|-----------|-------|
| 300x600     | 28px      | 46px  |
| 160x600     | 22px      | 36px  |
| 320x480     | 28px      | 46px  |
| 300x250     | 18px      | 30px  |
| 728x90      | 20px      | 34px  |
| 320x50      | 10px      | inline (no wrap needed for small) |
| 300x50      | 10px      | inline (no wrap needed for small) |

> ⚠️ These widths may need slight nudging per browser — the user was in the middle of
> checking results when the session ended. Check `preview.html` in the up to banners folder.

#### `.copy` position override (important)
In shared.css, `.copy` is `position: absolute`. The "up to" banners override this:
```css
.copy { position: relative; }
```
This is needed because there is only one copy block (no stacking needed).

#### Animation
- No `copy-fade` animation (no copy rotation)
- `.copy-container` gets `animation: enter-up 0.5s ease both 0.2s` instead
- Small banners: `.copy-sm` gets `animation: enter-up 0.5s ease both 0s`

---

## Pending / needs verification

1. **"UP TO" wrap rendering** — user confirmed 300×600 looks correct. The other 4 large sizes (160×600, 320×480, 300×250, 728×90) had character-level breaks that were just fixed by increasing the widths and removing `word-break: break-word`. **Needs browser check.**

2. **Small banners (320×50, 300×50)** — "up to" versions exist but were not reviewed visually this session. They use a simplified inline layout (no wrap).

3. **Logo selection system** — deferred by user: "eventually I am going to tell you how to choose the logos." Base templates all use General logo. No switcher built yet.

4. **Copy 2 placeholder text** — base templates still have `Golden text / White text` as Copy 2 placeholder. Not addressed.

5. **Google Sheets integration** — mentioned in an earlier session, not started.

---

## Figma file reference
`https://www.figma.com/design/5qzsiaNHI4CNLM6eF0SdZ9/FUTURE---Banners`

Key node IDs used:
- `49:430` — Main Banner Templates section
- `49:484` — 728×90 banner node
- `59:582` — "Copy up to" frame (the UP TO copy structure)
  - `59:583` — "100% Bonus" text (30px, gold + white)
  - `59:584` — Row frame containing UP TO + $500
  - `59:585` — "UP TO" text (44px, white, width: 59px — forces wrap)
  - `59:586` — "$500" amount (100px, gold gradient)

---

## Base template file map

```
ba-banner-generator-v2.0/
  Assets/
    css/shared.css          ← fonts, animations, base layout
    js/shared.js            ← clickTag + 30s IAB stop (pauses video, freezes copy)
    videos/                 ← 300x600.mp4, 160x600.mp4, etc.
  templates/
    300x600.html
    160x600.html
    320x480.html
    300x250.html
    728x90.html
    320x50.html
    300x50.html
    up to banners/          ← "Up To $500" campaign variant
      [all 7 sizes + preview.html]
  preview.html              ← base template preview (all 7 sizes)
  CLAUDE.md                 ← project instructions
  HANDOFF.md                ← this file
```

---

## Shared.js — 30s IAB stop logic
```js
var clickTag = "";
setTimeout(function () {
  var selectors = ['.copy-1', '.copy-2'];
  selectors.forEach(function (sel) {
    var el = document.querySelector(sel);
    if (!el) return;  // safe — returns null in "up to" banners (no copy-1/2)
    var s = window.getComputedStyle(el);
    el.style.opacity   = s.opacity;
    el.style.transform = s.transform;
    el.style.animation = 'none';
  });
  var video = document.querySelector('.video-bg video');
  if (video) { video.pause(); }
}, 30000);
```

## Gold gradient angles (per banner)
- Default (shared.css): `141.31deg`
- 160×600 override: `126.52deg`
- 728×90 override: `160.56deg`
- "Up to" banners inherit the same per-size overrides
