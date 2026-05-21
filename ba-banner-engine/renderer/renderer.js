'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let rows      = [];
let videoDir  = '';
let outputDir = '';

// ── Toasts ───────────────────────────────────────────────────────────────────
function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// ── Elements ─────────────────────────────────────────────────────────────────
const sheetUrlEl     = document.getElementById('sheet-url');
const fetchBtn       = document.getElementById('fetch-btn');
const videoSection   = document.getElementById('video-section');
const outputSection  = document.getElementById('output-section');
const videoDirEl     = document.getElementById('video-dir');
const videoBtn       = document.getElementById('video-btn');
const outputDirEl    = document.getElementById('output-dir');
const outputBtn      = document.getElementById('output-btn');
const rowsSection    = document.getElementById('rows-section');
const rowsSummaryEl  = document.getElementById('rows-summary');
const rowsListEl     = document.getElementById('rows-list');
const selectAllBtn   = document.getElementById('select-all-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const generateSection = document.getElementById('generate-section');
const generateBtn    = document.getElementById('generate-btn');
const logSection     = document.getElementById('log-section');
const logEl          = document.getElementById('log');
const openOutputBtn  = document.getElementById('open-output-btn');

// ── Event listeners ───────────────────────────────────────────────────────────
fetchBtn.addEventListener('click', fetchSheet);
sheetUrlEl.addEventListener('keydown', e => { if (e.key === 'Enter') fetchSheet(); });
videoBtn.addEventListener('click', pickVideoDir);
outputBtn.addEventListener('click', pickOutputDir);
selectAllBtn.addEventListener('click', () => { setAllChecked(true); updateSummary(); });
deselectAllBtn.addEventListener('click', () => { setAllChecked(false); updateSummary(); });
generateBtn.addEventListener('click', runGenerate);
openOutputBtn.addEventListener('click', () => window.api.openPath(outputDir));

// ── Progress handler (registered once) ───────────────────────────────────────
window.api.onProgress(handleProgress);

// ── Sheet fetch ───────────────────────────────────────────────────────────────
async function fetchSheet() {
  const url = sheetUrlEl.value.trim();
  if (!url) {
    showToast('Paste a Google Sheets link first', 'error');
    sheetUrlEl.focus();
    return;
  }

  fetchBtn.classList.remove('fetched');
  fetchBtn.innerHTML = '<span class="spinner"></span>';
  fetchBtn.style.display = 'flex';
  fetchBtn.style.alignItems = 'center';
  fetchBtn.style.justifyContent = 'center';
  fetchBtn.disabled = true;

  try {
    rows = await window.api.fetchSheet(url);
    renderRows();
    fetchBtn.innerHTML = '<span style="font-size:15px;line-height:1">✓</span> Fetched';
    fetchBtn.classList.remove('next-step');
    fetchBtn.classList.add('fetched');
    sheetUrlEl.classList.remove('next-step');
    showToast(`Sheet fetched — ${rows.length} row${rows.length !== 1 ? 's' : ''} loaded`, 'success');
    // Step 2: unlock video folder
    videoBtn.classList.add('next-step');
    rowsSection.classList.remove('hidden');
  } catch (err) {
    fetchBtn.textContent = 'Fetch';
    fetchBtn.style.cssText = '';
    showToast(err.message, 'error', 5000);
  } finally {
    fetchBtn.disabled = false;
  }
}

// ── Folder pickers ────────────────────────────────────────────────────────────
async function pickVideoDir() {
  videoBtn.disabled = true;
  let dir;
  try { dir = await window.api.openFolder(); } finally { videoBtn.disabled = false; }
  if (!dir) return;
  videoDir = dir;
  videoDirEl.value = dir;
  videoDirEl.classList.add('has-value');
  videoBtn.innerHTML = '<span style="font-size:15px;line-height:1">✓</span> Videos';
  videoBtn.classList.remove('next-step');
  videoBtn.classList.add('selected');
  // Step 3: unlock output folder
  outputSection.classList.remove('locked');
  outputBtn.classList.add('next-step');
}

async function pickOutputDir() {
  outputBtn.disabled = true;
  let dir;
  try { dir = await window.api.openFolder(); } finally { outputBtn.disabled = false; }
  if (!dir) return;
  outputDir = dir;
  outputDirEl.value = dir;
  outputDirEl.classList.add('has-value');
  outputBtn.classList.remove('next-step');
  // Step 4: reveal preview + generate
  rowsSection.classList.remove('hidden');
  generateSection.classList.remove('hidden');
  updateSummary();
}

// ── Row rendering ─────────────────────────────────────────────────────────────
const VERTICALS = ['Dual', 'Sports', 'Casino'];

function renderRows() {
  rowsListEl.innerHTML = '';

  const grouped = {};
  VERTICALS.forEach(v => { grouped[v] = []; });
  rows.forEach((row, i) => {
    const v = row['Vertical'] || '';
    if (!grouped[v]) grouped[v] = [];
    grouped[v].push({ row, i });
  });

  VERTICALS.forEach(vertical => {
    const col = document.createElement('div');
    col.className = 'vertical-col';

    const header = document.createElement('div');
    header.className = 'vertical-col-header';
    header.textContent = vertical;
    col.appendChild(header);

    grouped[vertical].forEach(({ row, i }) => {
      const label = document.createElement('label');
      label.className = 'row-item';
      label.innerHTML = `
        <input type="checkbox" class="row-check" data-index="${i}" checked>
        <span class="row-info">
          <span class="row-funnel">${row['Funnel'] || '—'}</span>
          <span class="row-sep">/</span>
          <span class="row-channel">${row['Channel'] || '—'}</span>
        </span>
        <span class="row-count">7</span>
      `;
      col.appendChild(label);
    });

    rowsListEl.appendChild(col);
  });

  rowsListEl.querySelectorAll('.row-check').forEach(cb => {
    cb.addEventListener('change', updateSummary);
  });

  // Generate section revealed only after output folder is picked (step 4)
  if (outputDir) generateSection.classList.remove('hidden');
  updateSummary();
}

// ── Selection helpers ─────────────────────────────────────────────────────────
function getCheckedBoxes() {
  return [...rowsListEl.querySelectorAll('.row-check:checked')];
}

function setAllChecked(val) {
  rowsListEl.querySelectorAll('.row-check').forEach(cb => { cb.checked = val; });
}

function getSelectedRows() {
  return getCheckedBoxes().map(cb => rows[parseInt(cb.dataset.index)]);
}

function updateSummary() {
  const checked = getCheckedBoxes().length;
  const total   = checked * 7;
  rowsSummaryEl.textContent = `${rows.length} row${rows.length !== 1 ? 's' : ''} — ${checked} selected`;
  generateBtn.textContent = `⚡ Generate ${total} banner${total !== 1 ? 's' : ''}`;
  generateBtn.disabled = checked === 0 || !outputDir;
}

// ── Generation ────────────────────────────────────────────────────────────────
async function runGenerate() {
  const selected = getSelectedRows();
  if (!selected.length || !outputDir) return;

  generateBtn.disabled = true;
  openOutputBtn.classList.add('hidden');

  logEl.innerHTML = '';
  logSection.classList.remove('hidden');
  logEl.scrollTop = 0;

  await window.api.generate({ rows: selected, videoDir, outputDir });
}

// ── Progress handler ──────────────────────────────────────────────────────────
function handleProgress({ type, ...data }) {
  switch (type) {
    case 'row-start': {
      const el = document.createElement('div');
      el.className = 'log-row';
      el.innerHTML = `<span class="log-arrow">▶</span> ${data.vertical} / ${data.funnel} / ${data.channel}`;
      logEl.appendChild(el);
      break;
    }
    case 'size-done': {
      const el = document.createElement('div');
      el.className = 'log-size';
      el.innerHTML = `<span class="log-check">✓</span> ${data.size}`;
      logEl.appendChild(el);
      break;
    }
    case 'video-warning': {
      const el = document.createElement('div');
      el.className = 'log-warning';
      el.innerHTML = `⚠ No video found for: ${data.sizes.join(', ')} — using template placeholder`;
      logEl.appendChild(el);
      break;
    }
    case 'preview-done': {
      const el = document.createElement('div');
      el.className = 'log-preview';
      el.innerHTML = `<span class="log-check">✓</span> preview.html`;
      logEl.appendChild(el);
      break;
    }
    case 'complete': {
      const el = document.createElement('div');
      el.className = 'log-complete';
      el.innerHTML = `✓ Done — ${data.total} banner${data.total !== 1 ? 's' : ''} generated`;
      logEl.appendChild(el);
      openOutputBtn.classList.remove('hidden');
      generateBtn.disabled = false;
      generateBtn.textContent = `✓ ${data.total} banner${data.total !== 1 ? 's' : ''} generated`;
      window.api.openPath(outputDir + '/_preview.html');
      break;
    }
    case 'error': {
      const el = document.createElement('div');
      el.className = 'log-error';
      el.textContent = `✗ ${data.message}`;
      logEl.appendChild(el);
      generateBtn.disabled = false;
      updateSummary();
      break;
    }
  }
  logEl.scrollTop = logEl.scrollHeight;
}
