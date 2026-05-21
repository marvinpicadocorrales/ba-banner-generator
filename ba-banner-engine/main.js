'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 620,
    height: 760,
    minWidth: 560,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d000f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('renderer/index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC: open folder dialog ───────────────────────────────────────────────────
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], buttonLabel: 'Choose' });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC: open path in Finder ──────────────────────────────────────────────────
ipcMain.handle('shell:openPath', async (_, folderPath) => {
  await shell.openPath(folderPath);
});

// ── IPC: fetch + parse sheet ──────────────────────────────────────────────────
ipcMain.handle('sheet:fetch', async (_, url) => {
  const { fetchSheet } = require('./generator/core');
  return fetchSheet(url);
});

// ── IPC: run generation (streams progress back via event) ─────────────────────
ipcMain.handle('generate:run', async (event, { rows, videoDir, outputDir }) => {
  const { generate } = require('./generator/core');
  const templateDir = path.join(__dirname, 'templates', 'general');
  const assetsDir   = path.join(__dirname, 'Assets');

  await generate(
    { rows, videoDir, outputDir, templateDir, assetsDir },
    (progress) => event.sender.send('generate:progress', progress)
  );
});
