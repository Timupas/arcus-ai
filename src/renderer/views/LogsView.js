import React from 'react';

/**
 * LogsView — Displays command execution history.
 */
export default function LogsView({ logs = [] }) {
  const getStatusBadge = (status) => {
    const map = {
      success: { label: 'OK', className: 'badge-success' },
      error: { label: 'ERR', className: 'badge-error' },
      blocked: { label: 'BLOCKED', className: 'badge-blocked' },
    };
    const info = map[status] || { label: status, className: 'badge-default' };
    return <span className={`log-badge ${info.className}`}>{info.label}</span>;
  };

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', { hour12: false });
    } catch {
      return '—';
    }
  };

  return (
    <div className="logs-view">
      <h2 className="logs-title">Command History</h2>

      {logs.length === 0 ? (
        <div className="logs-empty">
          <p>No commands executed yet.</p>
          <p className="logs-hint">
            Go to the <strong>Core</strong> tab and enter a command to get started.
          </p>
        </div>
      ) : (
        <div className="logs-table-wrapper">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Command</th>
                <th>Action</th>
                <th>Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className={`log-row log-${log.status}`}>
                  <td className="log-time">{formatTime(log.timestamp)}</td>
                  <td className="log-command">{log.command}</td>
                  <td className="log-action">{log.action}</td>
                  <td className="log-target" title={log.target}>
                    {log.target?.length > 50
                      ? log.target.substring(0, 50) + '...'
                      : log.target}
                  </td>
                  <td className="log-status">
                    {getStatusBadge(log.status)}
                    {log.error && (
                      <span className="log-error-hint" title={log.error}>
                        ⓘ
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
