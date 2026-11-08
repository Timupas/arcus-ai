/**
 * SettingsView.js
 * Comprehensive security settings panel for A.R.C.U.S.
 *
 * Sections:
 *   1. Access Permissions (Разрешения доступа)
 *   2. Application Whitelist (Белый список приложений)
 *   3. Blocked Paths (Заблокированные пути)
 *   4. Action Log & Confirmations (Журнал и подтверждения)
 */

import React, { useState, useCallback } from 'react';
import '../styles/settings.css';

// ─── Default permission items ──────────────────────────────────────────────────

const DEFAULT_ALLOWED = [
  { id: 'browser',    label: 'Управление браузером',        desc: 'Открытие URL и переключение вкладок',        enabled: true },
  { id: 'volume',     label: 'Управление громкостью',       desc: 'Изменение системной громкости',               enabled: true },
  { id: 'apps',       label: 'Запуск приложений (из списка)', desc: 'Только из белого списка приложений',         enabled: true },
  { id: 'youtube',    label: 'YouTube / Медиа',             desc: 'Воспроизведение и управление медиаконтентом',  enabled: true },
  { id: 'steam',      label: 'Интеграция со Steam',         desc: 'Запуск игр и просмотр библиотеки',            enabled: true },
];

const DEFAULT_BLOCKED = [
  { id: 'filesystem', label: 'Доступ к файловой системе',   desc: 'Прямое чтение и запись файлов',               enabled: false },
  { id: 'documents',  label: 'Папка «Документы»',           desc: 'Доступ к личным документам',                  enabled: false },
  { id: 'downloads',  label: 'Папка «Загрузки»',            desc: 'Доступ к загруженным файлам',                 enabled: false },
  { id: 'desktop',    label: 'Рабочий стол',                desc: 'Доступ к файлам на рабочем столе',            enabled: false },
  { id: 'appdata',    label: 'AppData',                     desc: 'Доступ к данным приложений',                  enabled: false },
  { id: 'registry',   label: 'Редактирование реестра',      desc: 'Изменение системного реестра Windows',         enabled: false },
  { id: 'network',    label: 'Конфигурация сети',           desc: 'Изменение сетевых настроек',                  enabled: false },
  { id: 'passwords',  label: 'Пароли и кошельки',           desc: 'Доступ к сохранённым паролям и кошелькам',     enabled: false },
];

// ─── Default whitelisted applications ──────────────────────────────────────────

const DEFAULT_WHITELIST = [
  { name: 'Google Chrome',   path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
  { name: 'Mozilla Firefox', path: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe' },
  { name: 'Microsoft Edge',  path: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' },
  { name: 'Steam',           path: 'C:\\Program Files (x86)\\Steam\\steam.exe' },
  { name: 'Discord',         path: 'C:\\Users\\%USERNAME%\\AppData\\Local\\Discord\\Update.exe' },
  { name: 'Spotify',         path: 'C:\\Users\\%USERNAME%\\AppData\\Roaming\\Spotify\\Spotify.exe' },
  { name: 'VS Code',         path: 'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe' },
  { name: 'Проводник',       path: 'C:\\Windows\\explorer.exe' },
];

// ─── Default blocked paths ─────────────────────────────────────────────────────

const DEFAULT_BLOCKED_PATHS = [
  'C:\\Users\\%USERNAME%\\Documents',
  'C:\\Users\\%USERNAME%\\Desktop',
  'C:\\Users\\%USERNAME%\\Downloads',
  'C:\\Users\\%USERNAME%\\AppData',
  'C:\\Users\\%USERNAME%\\AppData\\Roaming\\Ethereum',
  'C:\\Users\\%USERNAME%\\AppData\\Roaming\\Bitcoin',
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a file name from a full path for display */
function fileNameFromPath(p) {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1];
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SettingsView() {
  // Permissions state
  const [allowed, setAllowed]   = useState(DEFAULT_ALLOWED);
  const [blocked, setBlocked]   = useState(DEFAULT_BLOCKED);

  // Whitelist state
  const [whitelist, setWhitelist] = useState(DEFAULT_WHITELIST);

  // Blocked paths state
  const [blockedPaths, setBlockedPaths] = useState(DEFAULT_BLOCKED_PATHS);

  // Confirmation toggles
  const [confirmAll, setConfirmAll]   = useState(true);
  const [logCommands, setLogCommands] = useState(true);
  const [notifyBlock, setNotifyBlock] = useState(true);

  // ── Permission toggle ────────────────────────────────────────────────────────
  const togglePermission = useCallback((id, list, setList) => {
    setList(prev =>
      prev.map(item =>
        item.id === id ? { ...item, enabled: !item.enabled } : item,
      ),
    );
    // Persist through API
    if (window.arcusAPI?.security?.updatePolicy) {
      window.arcusAPI.security.updatePolicy({ id, toggled: true });
    }
  }, []);

  // ── Whitelist management ─────────────────────────────────────────────────────
  const addApplication = useCallback(async () => {
    try {
      if (window.arcusAPI?.dialogs?.openFile) {
        const result = await window.arcusAPI.dialogs.openFile({
          title: 'Выберите приложение',
          filters: [{ name: 'Приложения', extensions: ['exe', 'lnk'] }],
        });
        if (result && result.filePath) {
          const name = fileNameFromPath(result.filePath).replace(/\.\w+$/, '');
          setWhitelist(prev => [...prev, { name, path: result.filePath }]);
        }
      }
    } catch (err) {
      console.error('[SettingsView] Failed to add application:', err);
    }
  }, []);

  const removeApplication = useCallback((index) => {
    setWhitelist(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ── Blocked path management ──────────────────────────────────────────────────
  const addBlockedPath = useCallback(async () => {
    try {
      if (window.arcusAPI?.dialogs?.openDirectory) {
        const result = await window.arcusAPI.dialogs.openDirectory({
          title: 'Выберите папку для блокировки',
        });
        if (result && result.directoryPath) {
          setBlockedPaths(prev => [...prev, result.directoryPath]);
        }
      }
    } catch (err) {
      console.error('[SettingsView] Failed to add blocked path:', err);
    }
  }, []);

  const removeBlockedPath = useCallback((index) => {
    setBlockedPaths(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ── Reset to defaults ────────────────────────────────────────────────────────
  const resetDefaults = useCallback(() => {
    setAllowed(DEFAULT_ALLOWED);
    setBlocked(DEFAULT_BLOCKED);
    setWhitelist(DEFAULT_WHITELIST);
    setBlockedPaths(DEFAULT_BLOCKED_PATHS);
    setConfirmAll(true);
    setLogCommands(true);
    setNotifyBlock(true);
    if (window.arcusAPI?.security?.updatePolicy) {
      window.arcusAPI.security.updatePolicy({ reset: true });
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="settings-view">
      {/* ── Section 1: Access Permissions ─────────────────────────────────── */}
      <section className="settings-section">
        <h2 className="section-title">
          <span className="section-icon">🛡️</span>
          Разрешения доступа
        </h2>
        <p className="section-subtitle">Управляйте тем, что A.R.C.U.S. может делать в вашей системе</p>

        <div className="permissions-grid">
          {/* Allowed items */}
          {allowed.map(item => (
            <div key={item.id} className={`permission-card ${item.enabled ? 'allowed' : 'disabled'}`}>
              <div className="permission-header">
                <span className={`permission-status ${item.enabled ? 'status-allowed' : 'status-blocked'}`}>
                  {item.enabled ? '✓' : '✕'}
                </span>
                <span className="permission-label">{item.label}</span>
              </div>
              <p className="permission-desc">{item.desc}</p>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={() => togglePermission(item.id, allowed, setAllowed)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          ))}

          {/* Blocked items */}
          {blocked.map(item => (
            <div key={item.id} className={`permission-card ${item.enabled ? 'allowed' : 'disabled'}`}>
              <div className="permission-header">
                <span className={`permission-status ${item.enabled ? 'status-allowed' : 'status-blocked'}`}>
                  {item.enabled ? '✓' : '✕'}
                </span>
                <span className="permission-label">{item.label}</span>
              </div>
              <p className="permission-desc">{item.desc}</p>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={() => togglePermission(item.id, blocked, setBlocked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 2: Application Whitelist ──────────────────────────────── */}
      <section className="settings-section">
        <h2 className="section-title">
          <span className="section-icon">📋</span>
          Белый список приложений
        </h2>
        <p className="section-subtitle">Приложения, которые A.R.C.U.S. может запускать</p>

        <div className="whitelist-container">
          {whitelist.map((app, index) => (
            <div key={index} className="whitelist-item">
              <div className="whitelist-icon">📦</div>
              <div className="whitelist-info">
                <span className="whitelist-name">{app.name}</span>
                <span className="whitelist-path">{app.path}</span>
              </div>
              <button
                className="btn-remove"
                onClick={() => removeApplication(index)}
                title="Удалить"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button className="btn-add" onClick={addApplication}>
          <span className="btn-add-icon">+</span>
          Добавить приложение
        </button>
      </section>

      {/* ── Section 3: Blocked Paths ─────────────────────────────────────── */}
      <section className="settings-section">
        <h2 className="section-title">
          <span className="section-icon">🔒</span>
          Заблокированные пути
        </h2>
        <p className="section-subtitle">Директории, к которым доступ запрещён</p>

        <div className="blocked-paths-container">
          {blockedPaths.map((p, index) => (
            <div key={index} className="blocked-path-item">
              <span className="path-lock-icon">🔐</span>
              <span className="path-text">{p}</span>
              <button
                className="btn-remove"
                onClick={() => removeBlockedPath(index)}
                title="Удалить"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button className="btn-add" onClick={addBlockedPath}>
          <span className="btn-add-icon">+</span>
          Добавить защищённый путь
        </button>
      </section>

      {/* ── Section 4: Action Log & Confirmations ────────────────────────── */}
      <section className="settings-section">
        <h2 className="section-title">
          <span className="section-icon">⚙️</span>
          Журнал и подтверждения
        </h2>
        <p className="section-subtitle">Настройки логирования и подтверждений</p>

        <div className="confirmations-list">
          <div className="confirmation-item">
            <div className="confirmation-info">
              <span className="confirmation-label">Запрашивать подтверждение для всех системных действий</span>
              <span className="confirmation-desc">A.R.C.U.S. будет спрашивать разрешение перед выполнением</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={confirmAll} onChange={() => setConfirmAll(v => !v)} />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="confirmation-item">
            <div className="confirmation-info">
              <span className="confirmation-label">Логировать все команды</span>
              <span className="confirmation-desc">Сохранять историю всех выполненных действий</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={logCommands} onChange={() => setLogCommands(v => !v)} />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="confirmation-item">
            <div className="confirmation-info">
              <span className="confirmation-label">Уведомлять о заблокированных действиях</span>
              <span className="confirmation-desc">Показывать уведомление при блокировке запроса</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={notifyBlock} onChange={() => setNotifyBlock(v => !v)} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* Danger zone */}
        <div className="danger-zone">
          <h3 className="danger-title">⚠️ Опасная зона</h3>
          <p className="danger-desc">Сброс всех настроек безопасности к значениям по умолчанию</p>
          <button className="btn-danger" onClick={resetDefaults}>
            Сбросить к настройкам по умолчанию
          </button>
        </div>
      </section>
    </div>
  );
}
