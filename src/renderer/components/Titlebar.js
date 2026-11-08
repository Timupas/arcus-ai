/**
 * Titlebar.js
 * Custom frameless window titlebar for A.R.C.U.S.
 *
 * Layout:
 *   Left   — A.R.C.U.S. logo/text with subtle glow
 *   Center — Tab navigation (Ядро, Настройки, Журнал) with animated underline
 *   Right  — Minimize, Maximize, Close window control buttons
 *
 * The entire bar is a drag region except for interactive elements.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import '../styles/titlebar.css';

// ─── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'core',     label: 'Ядро' },
  { key: 'settings', label: 'Настройки' },
  { key: 'logs',     label: 'Журнал' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Titlebar({ activeTab = 'core', onTabChange }) {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabsRef = useRef(null);

  // Update animated underline indicator position
  useEffect(() => {
    if (!tabsRef.current) return;
    const activeEl = tabsRef.current.querySelector(`[data-tab="${activeTab}"]`);
    if (activeEl) {
      const parentRect = tabsRef.current.getBoundingClientRect();
      const tabRect    = activeEl.getBoundingClientRect();
      setIndicatorStyle({
        left:  tabRect.left - parentRect.left,
        width: tabRect.width,
      });
    }
  }, [activeTab]);

  // Window control handlers
  const handleMinimize = useCallback(() => {
    if (window.arcusAPI?.window?.minimize) {
      window.arcusAPI.window.minimize();
    }
  }, []);

  const handleMaximize = useCallback(() => {
    if (window.arcusAPI?.window?.maximize) {
      window.arcusAPI.window.maximize();
    }
  }, []);

  const handleClose = useCallback(() => {
    if (window.arcusAPI?.window?.close) {
      window.arcusAPI.window.close();
    }
  }, []);

  return (
    <div className="titlebar">
      {/* Left: Logo */}
      <div className="titlebar-logo">
        <span className="logo-text">A.R.C.U.S.</span>
      </div>

      {/* Center: Tab navigation */}
      <nav className="titlebar-tabs" ref={tabsRef}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            data-tab={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onTabChange && onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        {/* Animated underline indicator */}
        <div
          className="tab-indicator"
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            width:     `${indicatorStyle.width}px`,
          }}
        />
      </nav>

      {/* Right: Window controls */}
      <div className="titlebar-controls">
        <button className="control-btn control-minimize" onClick={handleMinimize} title="Свернуть">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button className="control-btn control-maximize" onClick={handleMaximize} title="Развернуть">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button className="control-btn control-close" onClick={handleClose} title="Закрыть">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
