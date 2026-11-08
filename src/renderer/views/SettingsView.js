import React, { useState, useEffect, useCallback } from 'react';
import '../styles/settings.css';

/**
 * SettingsView — Security policy and API keys configuration panel.
 */
export default function SettingsView() {
  const [policy, setPolicy] = useState(null);
  const [apiKeys, setApiKeys] = useState({ googleApiKey: '', groqApiKey: '' });
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Load policy & API keys on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [policyData, keysData] = await Promise.all([
          window.arcusAPI?.security?.getPolicy(),
          window.arcusAPI?.settings?.getApiKeys(),
        ]);
        if (policyData) setPolicy(policyData);
        if (keysData) setApiKeys(keysData);
      } catch (err) {
        setStatusMessage(`Ошибка загрузки настроек: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Save API keys
  const handleSaveApiKeys = useCallback(async () => {
    setSavingKeys(true);
    setStatusMessage('');
    try {
      const res = await window.arcusAPI?.settings?.saveApiKeys(apiKeys);
      if (res?.success) {
        setStatusMessage('✓ API ключи успешно сохранены и применены!');
      } else {
        setStatusMessage(`Ошибка сохранения: ${res?.error || 'Неизвестная ошибка'}`);
      }
    } catch (err) {
      setStatusMessage(`Ошибка: ${err.message}`);
    } finally {
      setSavingKeys(false);
      setTimeout(() => setStatusMessage(''), 4000);
    }
  }, [apiKeys]);

  // Open external instruction link in browser
  const openExternalUrl = (url) => {
    window.arcusAPI?.system?.openUrl(url);
  };

  return (
    <div
      className="settings-view"
      style={{
        backgroundColor: '#000000',
        color: '#e0e0e8',
        padding: '28px 36px',
        height: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <h2
          style={{
            fontSize: '22px',
            color: '#00d4ff',
            letterSpacing: '2px',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span>⚙</span> НАСТРОЙКИ A.R.C.U.S.
        </h2>
        <p style={{ color: '#8888a0', fontSize: '13px', marginBottom: '28px' }}>
          Управление голосовыми сервисами, API ключами и политикой безопасности системы
        </p>

        {statusMessage && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: '8px',
              backgroundColor: statusMessage.startsWith('✓') ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 68, 102, 0.12)',
              border: `1px solid ${statusMessage.startsWith('✓') ? '#00ff88' : '#ff4466'}`,
              color: statusMessage.startsWith('✓') ? '#00ff88' : '#ff4466',
              marginBottom: '22px',
              fontSize: '14px',
            }}
          >
            {statusMessage}
          </div>
        )}

        {/* ─── СЕКЦИЯ 1: ГОЛОСОВЫЕ СЛУЖБЫ И GOOGLE API KEY ─── */}
        <section
          style={{
            backgroundColor: '#05050a',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '32px',
            boxShadow: '0 0 20px rgba(0, 212, 255, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '17px', color: '#00d4ff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎙</span> Голосовой ввод и Google Cloud Speech API
            </h3>
            <span
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: apiKeys.googleApiKey ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 170, 51, 0.15)',
                color: apiKeys.googleApiKey ? '#00ff88' : '#ffaa33',
                border: `1px solid ${apiKeys.googleApiKey ? '#00ff88' : '#ffaa33'}`,
              }}
            >
              {apiKeys.googleApiKey ? '✓ Ключ настроен' : '⚠️ Ключ не введен'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '28px', alignItems: 'start' }}>
            {/* Левая колонка: Ввод ключа */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#c0c0d0', marginBottom: '8px' }}>
                Google Cloud API Key (с поддержкой Speech-to-Text API):
              </label>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={apiKeys.googleApiKey || ''}
                  onChange={(e) => setApiKeys({ ...apiKeys, googleApiKey: e.target.value })}
                  style={{
                    flex: 1,
                    backgroundColor: '#0a0a14',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '10px 14px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? 'Скрыть' : 'Показать'}
                  style={{
                    backgroundColor: '#0a0a14',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '8px',
                    color: '#8888aa',
                    padding: '0 14px',
                    cursor: 'pointer',
                  }}
                >
                  {showKey ? '🙈' : '👁️'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleSaveApiKeys}
                  disabled={savingKeys}
                  style={{
                    backgroundColor: '#00d4ff',
                    color: '#000000',
                    fontWeight: '600',
                    fontSize: '13px',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 0 12px rgba(0, 212, 255, 0.4)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {savingKeys ? 'Сохранение...' : 'Сохранить и применить'}
                </button>

                {apiKeys.googleApiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setApiKeys({ ...apiKeys, googleApiKey: '' });
                      window.arcusAPI?.settings?.saveApiKeys({ ...apiKeys, googleApiKey: '' });
                    }}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(255, 68, 102, 0.4)',
                      color: '#ff4466',
                      padding: '9px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Сбросить
                  </button>
                )}
              </div>

              <p style={{ fontSize: '12px', color: '#777790', marginTop: '12px', lineHeight: '1.4' }}>
                После сохранения ключ активируется мгновенно: браузерный модуль распознавания Chromium получит доступ к серверам Google.
              </p>
            </div>

            {/* Правая колонка: Пошаговая инструкция */}
            <div
              style={{
                backgroundColor: 'rgba(0, 212, 255, 0.03)',
                border: '1px solid rgba(0, 212, 255, 0.15)',
                borderRadius: '10px',
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#00d4ff' }}>
                  📖 Где и как получить ключ:
                </span>
                <button
                  type="button"
                  onClick={() => openExternalUrl('https://console.cloud.google.com/apis/credentials')}
                  style={{
                    fontSize: '11px',
                    color: '#00ff88',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Открыть Console ↗
                </button>
              </div>

              <ol style={{ fontSize: '12px', color: '#b0b0c0', paddingLeft: '18px', margin: 0, lineHeight: '1.6' }}>
                <li>
                  Перейдите в{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternalUrl('https://console.cloud.google.com/');
                    }}
                    style={{ color: '#00d4ff', textDecoration: 'none' }}
                  >
                    Google Cloud Console
                  </a>
                  .
                </li>
                <li>Создайте бесплатный проект (кнопка вверху слева «New Project»).</li>
                <li>
                  В меню откройте <b>APIs & Services</b> → <b>Library</b>.
                </li>
                <li>
                  Найдите <b>«Cloud Speech-to-Text API»</b> и нажмите кнопку <b>Enable (Включить)</b>.
                </li>
                <li>
                  Перейдите в <b>Credentials</b> → нажмите <b>+ Create Credentials</b> → выберите <b>API key</b>.
                </li>
                <li>Скопируйте ключ (начинается на <code style={{ color: '#00ff88' }}>AIzaSy...</code>) и вставьте в поле слева!</li>
              </ol>

              <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(0,0,0,0.5)', fontSize: '11px', color: '#8888a0' }}>
                💡 <b>Подсказка:</b> Первые 60 минут распознавания речи в Google Cloud каждый месяц бесплатны для всех аккаунтов.
              </div>
            </div>
          </div>
        </section>

        {/* ─── СЕКЦИЯ 2: БЕЗОПАСНОСТЬ И РАЗРЕШЕНИЯ ДОСТУПА ─── */}
        <section
          style={{
            backgroundColor: '#05050a',
            border: '1px solid rgba(0, 212, 255, 0.15)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '32px',
          }}
        >
          <h3 style={{ fontSize: '17px', color: '#00d4ff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔒</span> Разрешения доступа (Security Sandbox)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {[
              { id: 'open-browser', name: 'Управление браузером', desc: 'Открытие ссылок и вкладок' },
              { id: 'search-youtube', name: 'YouTube / Медиа', desc: 'Поиск и запуск видео/музыки' },
              { id: 'open-steam', name: 'Steam и Игры', desc: 'Запуск и установка игр библиотеки' },
              { id: 'launch-app', name: 'Запуск приложений', desc: 'Калькулятор, блокнот, дискорд и др.' },
              { id: 'control-volume', name: 'Управление звуком', desc: 'Регулировка громкости Windows' },
              { id: 'open-folder', name: 'Открытие папок', desc: 'Только разрешенные каталоги' },
            ].map((perm) => {
              const isAllowed = policy?.allowedActions ? policy.allowedActions.includes(perm.id) : true;
              return (
                <div
                  key={perm.id}
                  style={{
                    backgroundColor: '#0a0a14',
                    border: `1px solid ${isAllowed ? 'rgba(0, 255, 136, 0.25)' : 'rgba(255, 68, 102, 0.25)'}`,
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff' }}>{perm.name}</div>
                    <div style={{ fontSize: '11px', color: '#888899' }}>{perm.desc}</div>
                  </div>
                  <span style={{ fontSize: '12px', color: isAllowed ? '#00ff88' : '#ff4466', fontWeight: 'bold' }}>
                    {isAllowed ? 'Разрешено' : 'Блок'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── СЕКЦИЯ 3: ЗАБЛОКИРОВАННЫЕ ЗОНЫ (ЗАЩИТА ДАННЫХ) ─── */}
        <section
          style={{
            backgroundColor: '#05050a',
            border: '1px solid rgba(255, 68, 102, 0.2)',
            borderRadius: '12px',
            padding: '24px',
          }}
        >
          <h3 style={{ fontSize: '17px', color: '#ff4466', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🛡️</span> Защищенные системные зоны (Полная блокировка)
          </h3>
          <p style={{ fontSize: '12px', color: '#8888a0', marginBottom: '14px' }}>
            A.R.C.U.S. изолирован в песочнице и физически не имеет доступа к вашим личным файлам, паролям и кошелькам:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
            {[
              '📁 Папка «Документы»',
              '📁 Папка «Загрузки»',
              '🔑 Криптокошельки (Exodus, Metamask)',
              '🌐 Профили браузеров (куки, пароли)',
              '⚙️ Системный реестр Windows',
              '🛡️ Ключи SSH и сертификаты',
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: 'rgba(255, 68, 102, 0.05)',
                  border: '1px solid rgba(255, 68, 102, 0.2)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#ff8899',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🚫</span> {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
