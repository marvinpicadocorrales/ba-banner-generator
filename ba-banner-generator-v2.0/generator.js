#!/usr/bin/env node
'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── Paths ───────────────────────────────────────────────────────────────────
const ROOT         = __dirname;
const ASSETS_DIR   = path.join(ROOT, 'Assets');
const OUTPUT_DIR   = path.join(ROOT, 'output');

function resolveTemplateDir(template) {
  const dir = path.join(ROOT, 'templates', template);
  return fs.existsSync(dir) ? dir : path.join(ROOT, 'templates', 'general');
}

// ─── Config ──────────────────────────────────────────────────────────────────
const SHEET_ID  = '1HJbmeLOKzwGLBi9-m7nP73SLNDq7exVcIE0POkD0QoA';
const SHEET_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

const SIZES       = ['300x600', '160x600', '320x480', '300x250', '728x90', '320x50', '300x50'];
const SMALL_SIZES = new Set(['320x50', '300x50']);

// ─── Logo SVGs ───────────────────────────────────────────────────────────────
const RAW_LOGOS = {};
for (const name of ['General', 'Casino', 'Sports']) {
  RAW_LOGOS[name.toLowerCase()] = fs.readFileSync(
    path.join(ASSETS_DIR, `BA-Logo-${name}.svg`), 'utf8'
  );
}

function getLogo(vertical, isSmall) {
  const key = (vertical || '').toLowerCase().trim();
  const svg = RAW_LOGOS[key] || RAW_LOGOS.general;
  if (isSmall) {
    return svg
      .replace('<svg ', '<svg class="logo-sm" ')
      .replace('width="132"', 'width="70"')
      .replace('height="28"', 'height="15"');
  }
  return svg.replace('<svg ', '<svg class="logo" ');
}

// ─── CSV ─────────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines   = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).reduce((rows, line) => {
    const cells = line.split(',').map(c => c.trim());
    if (cells.every(c => !c)) return rows;
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] || ''; });
    rows.push(row);
    return rows;
  }, []);
}

// ─── Copy-2 builder ──────────────────────────────────────────────────────────
function isUpTo(c2g, c2w) {
  return /up\s*to/i.test(c2g + ' ' + c2w);
}

function buildCopy2(c2Gold, c2White, size) {
  if (SMALL_SIZES.has(size)) {
    return (
      `<p class="copy-gold">${c2Gold}</p>\n` +
      `          <p class="copy-white">${c2White}</p>`
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
    `<p class="copy-gold">${c2Gold}</p>\n` +
    `        <p class="copy-white">${c2White}</p>`
  );
}

// ─── HTML injection ──────────────────────────────────────────────────────────

// Depth-counting replacement of copy-2 inner content — handles nested divs
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

// injectUpto: targets the static UP TO spans directly (used for the 'upto' template set)
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

function injectValues(html, { logoSvg, c1Gold, c1White, copy2Html, cta, isSmall, template, c2Gold, c2White }) {
  // Logo (different class for small banners)
  const logoRe = isSmall
    ? /<svg class="logo-sm"[\s\S]*?<\/svg>/
    : /<svg class="logo"[\s\S]*?<\/svg>/;
  html = html.replace(logoRe, logoSvg);

  if (template === 'upto') {
    // Static UP TO template — inject values directly into the existing spans
    html = injectUpto(html, c2Gold, c2White);
  } else {
    // Rotating copy template — replace copy-1 paragraphs then copy-2 block
    html = html.replace(/<p class="copy-gold">[\s\S]*?<\/p>/, `<p class="copy-gold">${c1Gold}</p>`);
    html = html.replace(/<p class="copy-white">[\s\S]*?<\/p>/, `<p class="copy-white">${c1White}</p>`);
    html = replaceCopy2(html, copy2Html);
  }

  // CTA
  html = html.replace(
    /<span class="cta-label">[\s\S]*?<\/span>/,
    `<span class="cta-label">${cta}</span>`
  );

  return html;
}

// ─── File helpers ─────────────────────────────────────────────────────────────
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// ─── Preview generator ───────────────────────────────────────────────────────
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

// ─── HTTP fetch with redirect following ──────────────────────────────────────
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

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching sheet…');
  const csv  = await fetchURL(SHEET_CSV);
  const rows = parseCSV(csv);
  console.log(`${rows.length} row(s) found\n`);

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

    const TEMPLATES_DIR = resolveTemplateDir(template);
    console.log(`▶  ${channel}  (${vertical} / ${funnel} / ${template})`);

    for (const size of SIZES) {
      const isSmall  = SMALL_SIZES.has(size);
      const tmplPath = path.join(TEMPLATES_DIR, size, `${size}.html`);
      const outDir   = path.join(OUTPUT_DIR, vertical, funnel, channel, size);
      const outFile  = path.join(outDir, `${size}.html`);

      let html = fs.readFileSync(tmplPath, 'utf8');

      html = injectValues(html, {
        logoSvg  : getLogo(vertical, isSmall),
        c1Gold,
        c1White,
        copy2Html: buildCopy2(c2Gold, c2White, size),
        cta,
        isSmall,
        template,
        c2Gold,
        c2White,
      });

      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outFile, html, 'utf8');

      copyDir(path.join(TEMPLATES_DIR, size, 'fonts'), path.join(outDir, 'fonts'));
      copyDir(path.join(TEMPLATES_DIR, size, 'video'), path.join(outDir, 'video'));

      process.stdout.write(`   ✓ ${size}\n`);
    }

    generatePreview(path.join(OUTPUT_DIR, vertical, funnel, channel), channel);
    console.log(`   ✓ preview.html\n`);
  }

  console.log(`Done → output/`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
