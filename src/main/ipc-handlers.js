const { shell } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { isPathAllowed, isActionAllowed, isCommandSafe, getSecurityPolicy, updateSecurityPolicy, getApiKeys, saveApiKeys } = require('./security');
const { processCommand } = require('./command-processor');
const https = require('https');

// Попытка загрузить модуль управления громкостью (может быть не установлен)
let loudness = null;
try {
  loudness = require('loudness');
} catch (err) {
  console.warn('[A.R.C.U.S.] loudness module not available:', err.message);
}

// Known Steam executable paths on Windows
const STEAM_PATHS = [
  'C:\\Program Files (x86)\\Steam\\steam.exe',
  'C:\\Program Files\\Steam\\steam.exe',
  'D:\\Steam\\steam.exe',
  'D:\\Games\\Steam\\steam.exe',
];

/**
 * Register all IPC handlers on the main process.
 * @param {Electron.IpcMain} ipcMain
 */
function registerIpcHandlers(ipcMain) {
  // ─── System: Open URL or Protocol in default browser/client ────────
  ipcMain.handle('system:open-url', async (_event, url) => {
    try {
      const cleanUrl = (url || '').trim();
      const lower = cleanUrl.toLowerCase();

      // Steam protocol handled directly via shell or exec for 100% reliability
      if (lower.startsWith('steam://')) {
        return new Promise((resolve) => {
          exec(`start "" "${cleanUrl}"`, { shell: true }, (err) => {
            if (err) {
              // Try direct steam.exe fallback
              let foundExe = STEAM_PATHS.find(p => fs.existsSync(p));
              if (foundExe) {
                exec(`start "" "${foundExe}" "${cleanUrl}"`, { shell: true }, (err2) => {
                  if (err2) resolve({ success: false, error: err2.message });
                  else resolve({ success: true });
                });
              } else {
                resolve({ success: false, error: err.message });
              }
            } else {
              resolve({ success: true });
            }
          });
        });
      }

      // Check protocol
      let parsed;
      try {
        parsed = new URL(cleanUrl);
      } catch {
        // If not a full URL, make it https
        parsed = new URL('https://' + cleanUrl);
      }

      const allowedProtocols = ['http:', 'https:', 'steam:', 'spotify:', 'discord:', 'mailto:'];
      if (!allowedProtocols.includes(parsed.protocol)) {
        return { success: false, error: `Протокол "${parsed.protocol}" заблокирован` };
      }

      if (!isActionAllowed('open-url')) {
        return { success: false, error: 'Действие "open-url" заблокировано политикой безопасности' };
      }

      await shell.openExternal(cleanUrl);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── System: Dedicated Steam Launch & Actions ─────────────────
  ipcMain.handle('system:open-steam', async (_event, subCommand = '') => {
    return new Promise((resolve) => {
      let target = subCommand.trim();
      if (!target || target === 'main') {
        target = 'steam://open/main';
      } else if (!target.startsWith('steam://') && !target.startsWith('http')) {
        target = `steam://${target}`;
      }

      // Try running via Windows shell
      exec(`start "" "${target}"`, { shell: true }, (err) => {
        if (!err) {
          resolve({ success: true, target });
        } else {
          // Fallback to steam.exe directly
          const found = STEAM_PATHS.find(p => fs.existsSync(p));
          if (found) {
            exec(`start "" "${found}"`, { shell: true }, (err2) => {
              if (err2) resolve({ success: false, error: err2.message });
              else resolve({ success: true, target: found });
            });
          } else {
            resolve({ success: false, error: 'Steam не найден. Проверьте путь установки Steam.' });
          }
        }
      });
    });
  });

  // ─── System: Create Note in Notepad ────────────────────────────
  ipcMain.handle('system:create-note-and-open', async (_event, text) => {
    try {
      const noteDir = path.join(os.homedir(), 'Desktop');
      // If desktop is restricted, use OS temp
      const targetDir = isPathAllowed(noteDir) ? noteDir : os.tmpdir();
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filePath = path.join(targetDir, `ARCUS_Заметка_${dateStr}.txt`);

      const content = `=====================================\n  A.R.C.U.S. — Заметка пользователя\n  Дата: ${new Date().toLocaleString('ru-RU')}\n=====================================\n\n${text}\n`;

      fs.writeFileSync(filePath, content, 'utf8');

      return new Promise((resolve) => {
        exec(`start notepad.exe "${filePath}"`, { shell: true }, (err) => {
          if (err) resolve({ success: false, error: err.message });
          else resolve({ success: true, path: filePath });
        });
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── System: Launch application by name or path ───────────────
  ipcMain.handle('system:open-app', async (_event, appTarget) => {
    try {
      if (!isActionAllowed('launch-app')) {
        return { success: false, error: 'Запуск приложений запрещен политикой безопасности' };
      }

      const target = (appTarget || '').trim();

      // If it's a known protocol or website
      if (target.startsWith('http://') || target.startsWith('https://')) {
        await shell.openExternal(target);
        return { success: true };
      }

      if (target.startsWith('steam://')) {
        return new Promise((resolve) => {
          exec(`start "" "${target}"`, { shell: true }, (err) => {
            if (err) resolve({ success: false, error: err.message });
            else resolve({ success: true });
          });
        });
      }

      // Check security for file paths
      if (target.includes('\\') || target.includes('/')) {
        if (!isPathAllowed(target)) {
          return { success: false, error: `Доступ к пути "${target}" заблокирован` };
        }
      }

      return new Promise((resolve) => {
        exec(`start "" "${target}"`, { shell: true }, (err) => {
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── System: Open folder in explorer ──────────────────────────
  ipcMain.handle('system:open-folder', async (_event, folderPath) => {
    try {
      let resolved = folderPath.trim();
      // Aliases
      if (resolved.toLowerCase() === 'загрузки' || resolved.toLowerCase() === 'downloads') {
        resolved = path.join(os.homedir(), 'Downloads');
      } else if (resolved.toLowerCase() === 'диск d' || resolved.toLowerCase() === 'диск d:') {
        resolved = 'D:\\';
      } else if (resolved.toLowerCase() === 'диск c' || resolved.toLowerCase() === 'диск c:') {
        resolved = 'C:\\';
      }

      await shell.openPath(resolved);
      return { success: true, path: resolved };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── System: Get current volume ───────────────────────────────
  ipcMain.handle('system:volume-get', async () => {
    try {
      if (!loudness) {
        return { success: false, error: 'Модуль loudness не загружен' };
      }
      const vol = await loudness.getVolume();
      const muted = await loudness.getMuted();
      return { success: true, volume: vol, muted };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── System: Set volume level ─────────────────────────────────
  ipcMain.handle('system:volume-set', async (_event, level) => {
    try {
      if (!isActionAllowed('control-volume')) {
        return { success: false, error: 'Управление громкостью заблокировано' };
      }

      const clampedLevel = Math.max(0, Math.min(100, Math.round(level)));

      if (loudness) {
        await loudness.setVolume(clampedLevel);
        if (clampedLevel > 0) await loudness.setMuted(false);
        return { success: true, volume: clampedLevel };
      }

      // Fallback via PowerShell Audio Endpoint if loudness isn't installed
      const psCommand = `$obj = New-Object -ComObject WScript.Shell; 1..50 | ForEach-Object { $obj.SendKeys([char]174) }; $steps = [math]::Round(${clampedLevel}/2); 1..$steps | ForEach-Object { $obj.SendKeys([char]175) }`;
      exec(`powershell -Command "${psCommand}"`, () => {});
      return { success: true, volume: clampedLevel };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Security: Check permission ───────────────────────────────
  ipcMain.handle('security:check-permission', async (_event, action, target) => {
    const actionAllowed = isActionAllowed(action);
    const pathAllowed = target ? isPathAllowed(target) : true;
    return {
      allowed: actionAllowed && pathAllowed,
      actionAllowed,
      pathAllowed,
      action,
      target,
    };
  });

  // ─── Security: Get policy ────────────────────────────────────
  ipcMain.handle('security:get-policy', async () => {
    return getSecurityPolicy();
  });

  // ─── Security: Update policy ─────────────────────────────────
  ipcMain.handle('security:update-policy', async (_event, policy) => {
    try {
      updateSecurityPolicy(policy);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Settings: API Keys ──────────────────────────────────────
  ipcMain.handle('settings:get-api-keys', async () => {
    return getApiKeys();
  });

  ipcMain.handle('settings:save-api-keys', async (_event, keys) => {
    try {
      saveApiKeys(keys);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── System: Transcribe Audio via Google Cloud Speech REST API ─
  ipcMain.handle('system:transcribe-audio', async (_event, audioBase64) => {
    try {
      const { googleApiKey } = getApiKeys();
      if (!googleApiKey) {
        return { success: false, error: 'Google API Key не настроен в разделе Settings' };
      }

      return new Promise((resolve) => {
        const payload = JSON.stringify({
          config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'ru-RU',
            alternativeLanguageCodes: ['en-US'],
          },
          audio: {
            content: audioBase64,
          },
        });

        const req = https.request(
          `https://speech.googleapis.com/v1/speech:recognize?key=${googleApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                const json = JSON.parse(data);
                if (json.error) {
                  resolve({ success: false, error: json.error.message });
                } else {
                  const transcript = json.results?.[0]?.alternatives?.[0]?.transcript || '';
                  resolve({ success: true, transcript });
                }
              } catch (e) {
                resolve({ success: false, error: e.message });
              }
            });
          }
        );

        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.write(payload);
        req.end();
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── Process natural language command ─────────────────────────
  ipcMain.handle('process-command', async (_event, text) => {
    try {
      const result = processCommand(text);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerIpcHandlers };
