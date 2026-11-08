import React, { useState, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import CoreView from './views/CoreView';
import SettingsView from './views/SettingsView';
import LogsView from './views/LogsView';

/**
 * Custom frameless titlebar component with navigation tabs
 */
function Titlebar() {
  const handleMinimize = useCallback(() => window.arcusAPI?.window.minimize(), []);
  const handleMaximize = useCallback(() => window.arcusAPI?.window.maximize(), []);
  const handleClose = useCallback(() => window.arcusAPI?.window.close(), []);

  return (
    <header className="titlebar">
      <div className="titlebar-drag">
        <div className="titlebar-brand">
          <span className="titlebar-logo">◆</span>
          <span className="titlebar-title">A.R.C.U.S.</span>
        </div>

        <nav className="titlebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `titlebar-tab ${isActive ? 'active' : ''}`}
          >
            Core
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => `titlebar-tab ${isActive ? 'active' : ''}`}
          >
            Settings
          </NavLink>
          <NavLink
            to="/logs"
            className={({ isActive }) => `titlebar-tab ${isActive ? 'active' : ''}`}
          >
            Logs
          </NavLink>
        </nav>
      </div>

      <div className="titlebar-controls">
        <button className="titlebar-btn minimize" onClick={handleMinimize} title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button className="titlebar-btn maximize" onClick={handleMaximize} title="Maximize">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button className="titlebar-btn close" onClick={handleClose} title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </header>
  );
}

/**
 * Main application component with routing
 */
export default function App() {
  const [commandLogs, setCommandLogs] = useState([]);

  const addLog = useCallback((entry) => {
    setCommandLogs((prev) => [
      {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...entry,
      },
      ...prev,
    ].slice(0, 500)); // Keep last 500 entries
  }, []);

  return (
    <Router>
      <div className="app-container" style={{ backgroundColor: '#000000', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Titlebar />
        <main className="app-content" style={{ flex: 1, backgroundColor: '#000000', overflow: 'hidden', marginTop: '40px' }}>
          <Routes>
            <Route path="/" element={<CoreView addLog={addLog} />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/logs" element={<LogsView logs={commandLogs} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
