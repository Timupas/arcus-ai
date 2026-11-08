/**
 * StatusRing.js
 * Animated SVG ring that surrounds the ParticleSphere.
 *
 * Props:
 *   state      — 'idle' | 'listening' | 'speaking'
 *   audioLevel — 0–1 float for audio amplitude
 *   size       — diameter in px (default 420)
 */

import React, { useMemo } from 'react';

const TWO_PI = 2 * Math.PI;

/** Build SVG ring for each state */
export default function StatusRing({ state = 'idle', audioLevel = 0, size = 420 }) {
    const half   = size / 2;
    const radius = half - 6; // 6px inset so stroke isn't clipped
    const circumference = TWO_PI * radius;

    // Memoize dash configuration per state
    const { stroke, dashArray, dashOffset, animationClass, strokeWidth, opacity } = useMemo(() => {
        switch (state) {
            case 'listening':
                return {
                    stroke: '#00ff88',
                    dashArray: `${circumference}`,
                    dashOffset: '0',
                    animationClass: 'status-ring--listening',
                    strokeWidth: 2.5,
                    opacity: 0.7 + audioLevel * 0.3,
                };
            case 'speaking':
                return {
                    stroke: '#00d4ff',
                    dashArray: `${circumference * 0.15} ${circumference * 0.05}`,
                    dashOffset: '0',
                    animationClass: 'status-ring--speaking',
                    strokeWidth: 2 + audioLevel * 2,
                    opacity: 0.6 + audioLevel * 0.4,
                };
            default: // idle
                return {
                    stroke: '#00d4ff',
                    dashArray: `${circumference * 0.08} ${circumference * 0.04}`,
                    dashOffset: '0',
                    animationClass: 'status-ring--idle',
                    strokeWidth: 1.5,
                    opacity: 0.4,
                };
        }
    }, [state, audioLevel, circumference]);

    return (
        <svg
            className={`status-ring ${animationClass}`}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}
        >
            {/* Outer glow filter */}
            <defs>
                <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            <circle
                cx={half}
                cy={half}
                r={radius}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                opacity={opacity}
                filter="url(#ring-glow)"
            />

            {/* Second, thinner ring for depth */}
            <circle
                cx={half}
                cy={half}
                r={radius - 8}
                fill="none"
                stroke={stroke}
                strokeWidth={Math.max(0.5, strokeWidth * 0.4)}
                strokeDasharray={`${circumference * 0.03} ${circumference * 0.07}`}
                strokeLinecap="round"
                opacity={opacity * 0.4}
                filter="url(#ring-glow)"
            />
        </svg>
    );
}
