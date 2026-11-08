/**
 * LogsView.js
 * Command history and activity log view for A.R.C.U.S.
 *
 * Displays a scrollable, filterable, color-coded list of past commands.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../styles/logs.css';

// ─── Mock log data (replaced by real data from arcusAPI) ───────────────────────

const MOCK_LOGS = [
  { id: 1,  ts: '2025-01-15 14:32:01', command: 'Открой Google Chrome',                  action: 'Запуск chrome.exe',                  status: 'success' },
  { id: 2,  ts: '2025-01-15 14:32:45', command: 'Увеличь громкость до 80%',               action: 'Установка громкости: 80%',            status: 'success' },
  { id: 3,  ts: '2025-01-15 14:33:12', command: 'Открой папку Документы',                  action: 'Доступ к C:\\Users\\Documents',         status: 'blocked' },
  { id: 4,  ts: '2025-01-15 14:34:00', command: 'Запусти Steam',                           action: 'Запуск steam.exe',                    status: 'success' },
  { id: 5,  ts: '2025-01-15 14:35:22', command: 'Измени настройки сети',                   action: 'Изменение конфигурации сети',          status: 'blocked' },
  { id: 6,  ts: '2025-01-15 14:36:10', command: 'Включи музыку на YouTube',                action: 'Открытие youtube.com/music',          status: 'success' },
  { id: 7,  ts: '2025-01-15 14:37:05', command: 'Удали файлы из AppData',                  action: 'Доступ к AppData заблокирован',        status: 'blocked' },
  { id: 8,  ts: '2025-01-15 14:38:00', command: 'Открой VS Code',                          action: 'Запуск Code.exe',                     status: 'success' },
  { id: 9,  ts: '2025-01-15 14:38:30', command: 'Покажи пароли Chrome',                    action: 'Доступ к кошелькам запрещён',          status: 'blocked' },
  { id: 10, ts: '2025-01-15 14:39:15', command: 'Запусти неизвестное.exe',                  action: 'Приложение отсутствует в белом списке', status: 'error' },
  { id: 11, ts: '2025-01-15 14:40:00', command: 'Убавь громкость до 30%',                  action: 'Установка громкости: 30%',            status: 'success' },
  { id: 12, ts: '2025-01-15 14:41:20', command: 'Открой Discord',                          action: 'Запуск Discord',                      status: 'success' },
];

// ─── Filter configuration ──────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',     label: 'Все' },
  { key: 'success', label: 'Успешные' },
  { key: 'blocked', label: 'Заблокированные' },
  { key: 'error',   label: 'Ошибки' },
];

// ─── Status labels and icons ───────────────────────────────────────────────────

const STATUS_CONFIG = {
  success: { label: 'Успешно',        icon: '✓', className: 'status-success' },
  blocked: { label: 'Заблокировано',  icon: '⊘', className: 'status-blocked' },
  error:   { label: 'Ошибка',         icon: '✕', className: 'status-error' },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function LogsView() {
  const [logs, setLogs]       = useState([]);
  const [filter, setFilter]   = useState('all');
  const scrollRef             = useRef(null);

  // Load logs on mount
  useEffect(() => {
    async function fetchLogs() {
      try {
        if (window.arcusAPI?.logs?.getAll) {
          const data = await window.arcusAPI.logs.getAll();
          if (Array.isArray(data) && data.length > 0) {
            setLogs(data);
            return;
          }
        }
      } catch (err) {
        console.error('[LogsView] Failed to fetch logs:', err);
      }
      // Fallback to mock data
      setLogs(MOCK_LOGS);
    }
    fetchLogs();
  }, []);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Filter logs
  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.status === filter);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    if (window.arcusAPI?.logs?.clear) {
      window.arcusAPI.logs.clear();
    }
  }, []);

  // Count by status
  const counts = {
    all:     logs.length,
    success: logs.filter(l => l.status === 'success').length,
    blocked: logs.filter(l => l.status === 'blocked').length,
    error:   logs.filter(l => l.status === 'error').length,
  };

  return (
    <div className="logs-view">
      {/* Header bar */}
      <div className="logs-header">
        <div className="logs-title-row">
          <h2 className="logs-title">
            <span className="logs-icon">📜</span>
            Журнал действий
          </h2>
          <span className="logs-count">{filteredLogs.length} записей</span>
        </div>

        {/* Filter buttons */}
        <div className="logs-filters">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`filter-btn ${filter === f.key ? 'active' : ''} filter-${f.key}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="filter-count">{counts[f.key]}</span>
            </button>
          ))}

          <button className="btn-clear" onClick={clearLogs} title="Очистить журнал">
            🗑️ Очистить
          </button>
        </div>
      </div>

      {/* Log entries table */}
      <div className="logs-scroll" ref={scrollRef}>
        {filteredLogs.length === 0 ? (
          <div className="logs-empty">
            <span className="empty-icon">📭</span>
            <p>Журнал пуст</p>
          </div>
        ) : (
          <div className="logs-table">
            {/* Table header */}
            <div className="log-row log-row-header">
              <span className="log-cell cell-time">Время</span>
              <span className="log-cell cell-command">Команда</span>
              <span className="log-cell cell-action">Действие</span>
              <span className="log-cell cell-status">Статус</span>
            </div>

            {/* Table rows */}
            {filteredLogs.map(log => {
              const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.error;
              return (
                <div key={log.id} className={`log-row log-row-${log.status}`}>
                  <span className="log-cell cell-time">{log.ts}</span>
                  <span className="log-cell cell-command">{log.command}</span>
                  <span className="log-cell cell-action">{log.action}</span>
                  <span className={`log-cell cell-status`}>
                    <span className={`status-badge ${cfg.className}`}>
                      <span className="status-icon">{cfg.icon}</span>
                      {cfg.label}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
