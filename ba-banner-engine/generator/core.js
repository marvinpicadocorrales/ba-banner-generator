'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SIZES       = ['300x600', '160x600', '320x480', '300x250', '728x90', '320x50', '300x50'];
const SMALL_SIZES = new Set(['320x50', '300x50']);

// ── CSV ───────────────────────────────────────────────────────────────────────
function parseLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function parseCSV(text) {
  // Split into logical rows respecting quoted newlines
  const rawRows = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\r') continue;
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; cur += c; }
    } else if (c === '\n' && !inQuotes) {
      rawRows.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim()) rawRows.push(cur);

  const headers = parseLine(rawRows[0]);
  return rawRows.slice(1).reduce((rows, line) => {
    const cells = parseLine(line);
    if (cells.every(c => !c)) return rows;
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] || ''; });
    rows.push(row);
    return rows;
  }, []);
}

// ── HTTP fetch with redirect following ───────────────────────────────────────
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        return fetchURL(res.headers.location).then(resolve).catch(reject);
      }
      let buf = '';
      res.on('data', c => { buf += c; });
      res.on('end', () => resolve(buf));
    }).on('error', reject);
  });
}

// ── Sheet URL → CSV URL ───────────────────────────────────────────────────────
function sheetUrlToCsvUrl(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error('Invalid Google Sheets URL — paste the full sharing link.');
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
}

// ── Public: fetch + parse sheet ───────────────────────────────────────────────
async function fetchSheet(url) {
  const csvUrl = sheetUrlToCsvUrl(url.trim());
  const csv    = await fetchURL(csvUrl);
  return parseCSV(csv);
}

// ── Logo helpers ──────────────────────────────────────────────────────────────
const logoCache = {};

function getLogo(assetsDir, vertical, isSmall) {
  const key = isSmall ? 'general' : (vertical || '').toLowerCase().trim();
  const name = ['casino', 'sports'].includes(key) ? key : 'general';

  if (!logoCache[name]) {
    const svgName = name.charAt(0).toUpperCase() + name.slice(1);
    logoCache[name] = fs.readFileSync(
      path.join(assetsDir, `BA-Logo-${svgName}.svg`), 'utf8'
    );
  }

  const svg = logoCache[name];
  if (isSmall) {
    return svg
      .replace('<svg ', '<svg class="logo-sm" ')
      .replace('width="132"', 'width="70"')
      .replace('height="28"', 'height="15"');
  }
  return svg.replace('<svg ', '<svg class="logo" ');
}

// ── Copy-2 builder ────────────────────────────────────────────────────────────
function isUpTo(c2g, c2w) {
  return /up\s*to/i.test(c2g + ' ' + c2w);
}

function buildCopy2(c2Gold, c2White, size) {
  if (SMALL_SIZES.has(size)) {
    return (
      `<p class="copy-gold">${c2Gold.replace(/\n/g, '<br>')}</p>\n` +
      `          <p class="copy-white">${c2White.replace(/\n/g, '<br>')}</p>`
    );
  }

  if (isUpTo(c2Gold, c2White)) {
    const m      = c2White.match(/up\s*to\s+(.+)/i);
    const amount = m ? m[1].trim() : c2White;

    if (size === '728x90') {
      return (
        `<p>` +
        `<span class="copy-gold">${c2Gold}</span>` +
        `<span class="copy-white"> Bonus, up to </span>` +
        `<span class="copy-gold">${amount}</span>` +
        `</p>`
      );
    }

    return (
      `<p><span class="copy-gold">${c2Gold}</span><span class="copy-white"> Bonus</span></p>\n` +
      `        <div class="upto-row">\n` +
      `          <span class="copy-white copy-upto-label">UP TO</span>\n` +
      `          <span class="copy-gold copy-upto-amount">${amount}</span>\n` +
      `        </div>`
    );
  }

  return (
    `<p class="copy-gold">${c2Gold.replace(/\n/g, '<br>')}</p>\n` +
    `        <p class="copy-white">${c2White.replace(/\n/g, '<br>')}</p>`
  );
}

// ── Depth-counting copy-2 replacement ────────────────────────────────────────
function replaceCopy2(html, newContent) {
  const re    = /<div class="copy(?:-sm)? copy-2">/;
  const match = re.exec(html);
  if (!match) return html;

  const openEnd = match.index + match[0].length;
  let depth = 1;
  let i     = openEnd;

  while (i < html.length) {
    if (html[i] === '<') {
      const tag = html.slice(i);
      if (/^<div[\s>]/.test(tag)) depth++;
      else if (tag.startsWith('</div')) {
        depth--;
        if (depth === 0) break;
      }
    }
    i++;
  }

  return (
    html.slice(0, openEnd) +
    '\n        ' + newContent + '\n      ' +
    html.slice(i)
  );
}

// ── injectUpto: targets static UP TO spans directly ──────────────────────────
function injectUpto(html, c2Gold, c2White) {
  const m      = c2White.match(/up\s*to\s+(.+)/i);
  const amount = m ? m[1].trim() : c2White;
  html = html.replace(
    /<span class="copy-gold">[\s\S]*?<\/span>/,
    `<span class="copy-gold">${c2Gold}</span>`
  );
  html = html.replace(
    /<span class="copy-gold copy-upto-amount">[\s\S]*?<\/span>/,
    `<span class="copy-gold copy-upto-amount">${amount}</span>`
  );
  return html;
}

// ── HTML injection ────────────────────────────────────────────────────────────
function injectValues(html, { logoSvg, c1Gold, c1White, copy2Html, cta, isSmall, sharedCSS, sharedJS, template, c2Gold, c2White }) {
  // Inline shared.css so output is self-contained at any folder depth
  html = html.replace(
    /<link rel="stylesheet" href="[^"]*shared\.css">/,
    `<style>\n${sharedCSS}\n</style>`
  );

  // Inline shared.js
  html = html.replace(
    /<script src="[^"]*shared\.js"><\/script>/,
    `<script>\n${sharedJS}\n</script>`
  );

  // Logo
  const logoRe = isSmall
    ? /<svg class="logo-sm"[\s\S]*?<\/svg>/
    : /<svg class="logo"[\s\S]*?<\/svg>/;
  html = html.replace(logoRe, logoSvg);

  if (template === 'upto') {
    // Static UP TO template — inject values directly into existing spans
    html = injectUpto(html, c2Gold, c2White);
  } else {
    // Rotating copy template — replace copy-1 paragraphs then copy-2 block
    html = html.replace(/<p class="copy-gold">[\s\S]*?<\/p>/, `<p class="copy-gold">${c1Gold.replace(/\n/g, '<br>')}</p>`);
    html = html.replace(/<p class="copy-white">[\s\S]*?<\/p>/, `<p class="copy-white">${c1White.replace(/\n/g, '<br>')}</p>`);
    html = replaceCopy2(html, copy2Html);
  }

  // CTA
  html = html.replace(
    /<span class="cta-label">[\s\S]*?<\/span>/,
    `<span class="cta-label">${cta}</span>`
  );

  return html;
}

// ── File helpers ──────────────────────────────────────────────────────────────
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// ── Preview generator ─────────────────────────────────────────────────────────
function generatePreview(outChannelDir, channel) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>BA Banner Preview — ${channel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #3a3a3a; font-family: Arial, sans-serif; padding: 40px; min-width: 1200px; }

  .header { display: flex; align-items: center; gap: 20px; margin-bottom: 32px; }
  h1 { color: #aaa; font-size: 13px; font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase; flex: 1; }

  #timer-chip { display: flex; align-items: center; gap: 8px; background: #2a2a2a; border: 1px solid #444; border-radius: 20px; padding: 5px 14px 5px 10px; font-size: 12px; color: #aaa; letter-spacing: 0.04em; transition: background 0.3s, border-color 0.3s; }
  #timer-chip.running { border-color: #48ff80; color: #48ff80; }
  #timer-chip.stopped { background: #1a1a1a; border-color: #555; color: #666; }
  #timer-dot { width: 7px; height: 7px; border-radius: 50%; background: #48ff80; flex-shrink: 0; animation: blink 1s ease-in-out infinite; }
  #timer-chip.stopped #timer-dot { background: #555; animation: none; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }

  #toast { position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(80px); background: #15051d; border: 1px solid #48ff80; color: #48ff80; font-size: 13px; letter-spacing: 0.05em; padding: 10px 24px; border-radius: 40px; opacity: 0; transition: opacity 0.4s, transform 0.4s; pointer-events: none; white-space: nowrap; }
  #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

  #restart-btn { display: none; align-items: center; gap: 6px; background: none; border: 1px solid #555; color: #888; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; padding: 5px 14px; border-radius: 20px; cursor: pointer; transition: border-color 0.2s, color 0.2s; }
  #restart-btn:hover { border-color: #aaa; color: #ccc; }
  #restart-btn.visible { display: flex; }

  .grid { display: flex; flex-direction: column; gap: 0; }
  .row-top { display: flex; align-items: flex-start; gap: 20px; }
  .row-bottom { display: flex; align-items: flex-start; gap: 20px; padding-left: 500px; margin-top: -108px; }
  .cluster { display: flex; flex-direction: column; gap: 16px; }
  .slot { display: flex; flex-direction: column; gap: 7px; }
  .slot-label { color: #888; font-size: 11px; letter-spacing: 0.04em; }
  iframe { display: block; border: none; flex-shrink: 0; }
</style>
</head>
<body>

<div class="header">
  <h1>BA Banner Preview — ${channel}</h1>
  <div id="timer-chip" class="running">
    <span id="timer-dot"></span>
    <span id="timer-label">Animating — 0s</span>
  </div>
  <button id="restart-btn" onclick="restartAll()">↺ Restart</button>
</div>

<div id="toast">⏹ Banners stopped at 30s</div>

<div class="grid">
  <div class="row-top">
    <div class="slot">
      <span class="slot-label">160×600</span>
      <iframe src="160x600/160x600.html" width="160" height="600" scrolling="no"></iframe>
    </div>
    <div class="slot">
      <span class="slot-label">300×600</span>
      <iframe src="300x600/300x600.html" width="300" height="600" scrolling="no"></iframe>
    </div>
    <div class="slot">
      <span class="slot-label">320×480</span>
      <iframe src="320x480/320x480.html" width="320" height="480" scrolling="no"></iframe>
    </div>
    <div class="cluster">
      <div class="slot">
        <span class="slot-label">300×250</span>
        <iframe src="300x250/300x250.html" width="300" height="250" scrolling="no"></iframe>
      </div>
      <div class="slot">
        <span class="slot-label">320×50</span>
        <iframe src="320x50/320x50.html" width="320" height="50" scrolling="no"></iframe>
      </div>
      <div class="slot">
        <span class="slot-label">300×50</span>
        <iframe src="300x50/300x50.html" width="300" height="50" scrolling="no"></iframe>
      </div>
    </div>
  </div>
  <div class="row-bottom">
    <div class="slot">
      <span class="slot-label">728×90</span>
      <iframe src="728x90/728x90.html" width="728" height="90" scrolling="no"></iframe>
    </div>
  </div>
</div>

<script>
  var start = Date.now(), stopped = false;
  var chip  = document.getElementById('timer-chip');
  var label = document.getElementById('timer-label');
  var toast = document.getElementById('toast');
  var btn   = document.getElementById('restart-btn');

  function tick() {
    if (stopped) return;
    var elapsed = Math.floor((Date.now() - start) / 1000);
    if (elapsed >= 30) {
      stopped = true;
      label.textContent = 'Stopped at 30s';
      chip.className = 'stopped';
      toast.classList.add('show');
      setTimeout(function() { toast.classList.remove('show'); }, 4000);
      btn.classList.add('visible');
      return;
    }
    label.textContent = 'Animating — ' + elapsed + 's  (' + (30 - elapsed) + 's left)';
    setTimeout(tick, 250);
  }

  function restartAll() {
    document.querySelectorAll('iframe').forEach(function(f) { f.src = f.src; });
    start = Date.now(); stopped = false;
    chip.className = 'running';
    label.textContent = 'Animating — 0s';
    btn.classList.remove('visible');
    toast.classList.remove('show');
    tick();
  }

  tick();
</script>
</body>
</html>`;

  fs.writeFileSync(path.join(outChannelDir, 'preview.html'), html, 'utf8');
}

// ── Video placement ───────────────────────────────────────────────────────────
// Returns 'user' | 'missing'
// 'missing' = videoDir was set but no video found at any cascade level (small sizes never warn)
function placeVideo({ videoDir, vertical, funnel, channel, size, tmplSetDir, outDir }) {
  const outVideoDir = path.join(outDir, 'video');

  if (videoDir) {
    // Cascade: channel → funnel → vertical → root
    const candidates = [
      path.join(videoDir, vertical, funnel, channel, `${size}.mp4`),
      path.join(videoDir, vertical, funnel, `${size}.mp4`),
      path.join(videoDir, vertical, `${size}.mp4`),
      path.join(videoDir, `${size}.mp4`),
    ];

    for (const src of candidates) {
      if (fs.existsSync(src)) {
        fs.mkdirSync(outVideoDir, { recursive: true });
        fs.copyFileSync(src, path.join(outVideoDir, `${size}.mp4`));
        return 'user';
      }
    }

    // Nothing found in user folder — fall back to template placeholder
    copyDir(path.join(tmplSetDir, size, 'video'), outVideoDir);

    // Small sizes have no video by design, don't flag them
    return SMALL_SIZES.has(size) ? 'user' : 'missing';
  }

  // No videoDir set — use template placeholder silently
  copyDir(path.join(tmplSetDir, size, 'video'), outVideoDir);
  return 'user';
}

// ── Master preview ────────────────────────────────────────────────────────────
function generateMasterPreview(outputDir, processedRows) {
  // Build vertical → funnel → [channels] structure (preserving insertion order)
  const structure = {};
  for (const { vertical, funnel, channel } of processedRows) {
    if (!structure[vertical]) structure[vertical] = {};
    if (!structure[vertical][funnel]) structure[vertical][funnel] = [];
    if (!structure[vertical][funnel].includes(channel)) structure[vertical][funnel].push(channel);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>BA Banner Master Preview</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d0d0d; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; }

  /* ── Nav ── */
  .nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(13,13,13,0.96); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    padding: 16px 32px 0; display: flex; flex-direction: column; gap: 0;
  }

  /* Verticals */
  .verticals { display: flex; gap: 8px; margin-bottom: 16px; }
  /* Focus — visible ring for keyboard nav (AA 2.4.7) */
  :focus-visible { outline: 2px solid #48ff80; outline-offset: 3px; border-radius: 3px; }

  .v-btn {
    padding: 7px 22px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.4); background: transparent;
    color: #bbb; font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; cursor: pointer; transition: all 0.15s;
  }
  .v-btn:hover { border-color: rgba(255,255,255,0.65); color: #fff; }
  .v-btn.active { background: #5B2D8E; border-color: #5B2D8E; color: #fff; }

  /* Funnels */
  .funnels { display: flex; gap: 28px; border-bottom: 1px solid rgba(255,255,255,0.12); }
  .f-btn {
    background: none; border: none; color: #999;
    font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer; padding: 0 0 12px; border-bottom: 2px solid transparent; margin-bottom: -1px;
    transition: all 0.15s;
  }
  .f-btn:hover { color: #ddd; }
  .f-btn.active { color: #fff; border-bottom-color: #fff; }

  /* Channels */
  .channels { display: flex; gap: 6px; flex-wrap: wrap; padding: 14px 0; }
  .c-btn {
    padding: 4px 14px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.35); background: transparent;
    color: #aaa; font-size: 11px; font-weight: 700; letter-spacing: 0.07em;
    text-transform: uppercase; cursor: pointer; transition: all 0.15s;
  }
  .c-btn:hover { border-color: rgba(255,255,255,0.65); color: #fff; }
  .c-btn.active { background: #fff; border-color: #fff; color: #000; }

  /* ── Banners ── */
  .stage { padding: 40px 32px 60px; min-width: 1200px; overflow-x: auto; }
  .grid  { display: flex; flex-direction: column; gap: 0; }
  .row-top    { display: flex; align-items: flex-start; gap: 20px; }
  .row-bottom { display: flex; align-items: flex-start; gap: 20px; padding-left: 500px; margin-top: -108px; }
  .cluster    { display: flex; flex-direction: column; gap: 16px; }
  .slot       { display: flex; flex-direction: column; gap: 6px; }
  .slot-label { color: #999; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
  iframe      { display: block; border: none; flex-shrink: 0; background: #111; }

  /* ── Timer ── */
  .timer-row { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
  #timer-chip { display: flex; align-items: center; gap: 8px; background: #1a1a1a; border: 1px solid #555; border-radius: 20px; padding: 5px 14px 5px 10px; font-size: 12px; color: #999; letter-spacing: 0.04em; transition: all 0.3s; }
  #timer-chip.running { border-color: #48ff80; color: #48ff80; }
  #timer-chip.stopped { border-color: #555; color: #999; }
  #timer-dot  { width: 7px; height: 7px; border-radius: 50%; background: #48ff80; flex-shrink: 0; animation: blink 1s ease-in-out infinite; }
  #timer-chip.stopped #timer-dot { background: #666; animation: none; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
  #restart-btn { display:none; align-items:center; gap:6px; background:none; border:1px solid #555; color:#aaa; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; padding:5px 14px; border-radius:20px; cursor:pointer; transition:all 0.2s; }
  #restart-btn:hover { border-color:#aaa; color:#fff; }
  #restart-btn.show { display:flex; }
  #toast { position:fixed; bottom:32px; left:50%; transform:translateX(-50%) translateY(80px); background:#15051d; border:1px solid #48ff80; color:#48ff80; font-size:13px; letter-spacing:0.05em; padding:10px 24px; border-radius:40px; opacity:0; transition:opacity 0.4s,transform 0.4s; pointer-events:none; white-space:nowrap; }
  #toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
</style>
</head>
<body>

<nav class="nav" aria-label="Banner filters">
  <div class="verticals" id="verticals" role="group" aria-label="Vertical"></div>
  <div class="funnels"   id="funnels"   role="group" aria-label="Funnel"></div>
  <div class="channels"  id="channels"  role="group" aria-label="Channel"></div>
</nav>

<div class="stage">
  <div class="timer-row">
    <div id="timer-chip" class="running">
      <span id="timer-dot"></span>
      <span id="timer-label">Animating — 0s</span>
    </div>
    <button id="restart-btn" onclick="restartAll()">↺ Restart</button>
  </div>

  <div class="grid">
    <div class="row-top">
      <div class="slot"><span class="slot-label" aria-hidden="true">160×600</span><iframe id="f-160x600" title="160x600 banner" width="160" height="600" scrolling="no"></iframe></div>
      <div class="slot"><span class="slot-label" aria-hidden="true">300×600</span><iframe id="f-300x600" title="300x600 banner" width="300" height="600" scrolling="no"></iframe></div>
      <div class="slot"><span class="slot-label" aria-hidden="true">320×480</span><iframe id="f-320x480" title="320x480 banner" width="320" height="480" scrolling="no"></iframe></div>
      <div class="cluster">
        <div class="slot"><span class="slot-label" aria-hidden="true">300×250</span><iframe id="f-300x250" title="300x250 banner" width="300" height="250" scrolling="no"></iframe></div>
        <div class="slot"><span class="slot-label" aria-hidden="true">320×50</span><iframe id="f-320x50"  title="320x50 banner"  width="320" height="50"  scrolling="no"></iframe></div>
        <div class="slot"><span class="slot-label" aria-hidden="true">300×50</span><iframe id="f-300x50"  title="300x50 banner"  width="300" height="50"  scrolling="no"></iframe></div>
      </div>
    </div>
    <div class="row-bottom">
      <div class="slot"><span class="slot-label" aria-hidden="true">728×90</span><iframe id="f-728x90" title="728x90 banner" width="728" height="90" scrolling="no"></iframe></div>
    </div>
  </div>
</div>

<div id="toast">⏹ Banners stopped at 30s</div>

<script>
var data  = ${JSON.stringify(structure)};
var sizes = ['160x600','300x600','320x480','300x250','320x50','300x50','728x90'];
var selV, selF, selC;

function build(id, items, selVal, onClick) {
  var el = document.getElementById(id);
  el.innerHTML = '';
  items.forEach(function(val) {
    var btn = document.createElement('button');
    var active = val === selVal;
    btn.className = el.id.charAt(0) + '-btn' + (active ? ' active' : '');
    btn.textContent = val;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.onclick = function() { onClick(val); };
    el.appendChild(btn);
  });
}

function updateFrames() {
  sizes.forEach(function(s) {
    var f = document.getElementById('f-' + s);
    f.title = s + ' — ' + selV + ' / ' + selF + ' / ' + selC;
    f.src   = selV + '/' + selF + '/' + selC + '/' + s + '/' + s + '.html';
  });
  resetTimer();
}

function render() {
  build('verticals', Object.keys(data), selV, function(v) { selV = v; selF = Object.keys(data[v])[0]; selC = data[v][selF][0]; render(); });
  build('funnels',   Object.keys(data[selV]), selF, function(f) { selF = f; selC = data[selV][f][0]; build('funnels', Object.keys(data[selV]), selF, arguments.callee); build('channels', data[selV][selF], selC, channelClick); updateFrames(); });
  build('channels',  data[selV][selF], selC, channelClick);
  updateFrames();
}

function channelClick(c) { selC = c; build('channels', data[selV][selF], selC, channelClick); updateFrames(); }

// ── Timer ──
var timerStart, timerStopped;
function resetTimer() {
  timerStart = Date.now(); timerStopped = false;
  var chip = document.getElementById('timer-chip');
  chip.className = 'running';
  document.getElementById('timer-label').textContent = 'Animating — 0s';
  document.getElementById('restart-btn').classList.remove('show');
  document.getElementById('toast').classList.remove('show');
  tick();
}
function tick() {
  if (timerStopped) return;
  var el = Math.floor((Date.now() - timerStart) / 1000);
  if (el >= 30) {
    timerStopped = true;
    document.getElementById('timer-chip').className = 'stopped';
    document.getElementById('timer-label').textContent = 'Stopped at 30s';
    document.getElementById('restart-btn').classList.add('show');
    var t = document.getElementById('toast'); t.classList.add('show');
    setTimeout(function(){t.classList.remove('show');}, 4000);
    return;
  }
  document.getElementById('timer-label').textContent = 'Animating — ' + el + 's  (' + (30-el) + 's left)';
  setTimeout(tick, 250);
}
function restartAll() {
  sizes.forEach(function(s){ var f=document.getElementById('f-'+s); f.src=f.src; });
  resetTimer();
}

// ── Init ──
selV = Object.keys(data)[0];
selF = Object.keys(data[selV])[0];
selC = data[selV][selF][0];
render();
</script>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, '_preview.html'), html, 'utf8');
}

// ── Public: generate ──────────────────────────────────────────────────────────
async function generate({ rows, videoDir, outputDir, templateDir, assetsDir }, onProgress) {
  const sharedCSS = fs.readFileSync(path.join(assetsDir, 'css', 'shared.css'), 'utf8');
  const sharedJS  = fs.readFileSync(path.join(assetsDir, 'js',  'shared.js'),  'utf8');

  let totalBanners = 0;
  const processedRows = [];

  for (const row of rows) {
    const channel  = row['Channel']      || 'unknown';
    const vertical = row['Vertical']     || 'general';
    const funnel   = row['Funnel']       || 'unknown';
    const template = row['Template']     || 'general';
    const c1Gold   = row['Copy 1 GOLD']  || '';
    const c1White  = row['Copy 1 White'] || '';
    const c2Gold   = row['Copy 2 GOLD']  || '';
    const c2White  = row['Copy 2 White'] || '';
    const cta      = row['CTA']          || 'Learn more';

    // Resolve template set directory, fall back to general if not found
    const tmplSetDir = (() => {
      const dir = path.join(templateDir, '..', template);
      return fs.existsSync(dir) ? dir : templateDir;
    })();

    onProgress({ type: 'row-start', channel, vertical, funnel });

    const missingSizes = [];

    for (const size of SIZES) {
      const isSmall  = SMALL_SIZES.has(size);
      const tmplPath = path.join(tmplSetDir, size, `${size}.html`);
      const outDir   = path.join(outputDir, vertical, funnel, channel, size);
      const outFile  = path.join(outDir, `${size}.html`);

      let html = fs.readFileSync(tmplPath, 'utf8');

      html = injectValues(html, {
        logoSvg  : getLogo(assetsDir, vertical, isSmall),
        c1Gold,
        c1White,
        copy2Html: buildCopy2(c2Gold, c2White, size),
        cta,
        isSmall,
        sharedCSS,
        sharedJS,
        template,
        c2Gold,
        c2White,
      });

      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outFile, html, 'utf8');

      // Fonts: from the resolved template set
      copyDir(path.join(tmplSetDir, size, 'fonts'), path.join(outDir, 'fonts'));

      // Videos: cascading lookup, returns 'user' or 'missing'
      const videoStatus = placeVideo({ videoDir, vertical, funnel, channel, size, tmplSetDir, outDir });
      if (videoStatus === 'missing') missingSizes.push(size);

      totalBanners++;
      onProgress({ type: 'size-done', size });
    }

    if (missingSizes.length > 0) {
      onProgress({ type: 'video-warning', channel, vertical, funnel, sizes: missingSizes });
    }

    processedRows.push({ vertical, funnel, channel });

    const channelDir = path.join(outputDir, vertical, funnel, channel);
    generatePreview(channelDir, channel);
    onProgress({ type: 'preview-done', channel });
  }

  generateMasterPreview(outputDir, processedRows);
  onProgress({ type: 'complete', total: totalBanners });
}

module.exports = { fetchSheet, generate };
