/**
 * CoreView.js
 * Main view of A.R.C.U.S. — contains the particle sphere, status ring,
 * push‑to‑talk / toggle button, text input, and chat log.
 *
 * Voice pipeline:
 *   Microphone → AnalyserNode (audioLevel) → SpeechRecognition → processCommand → TTS
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ParticleSphere from './ParticleSphere';
import StatusRing from './StatusRing';
import '../styles/core-view.css';

// ─── Status labels (Russian UI) ────────────────────────────────────────────────

const STATUS_LABELS = {
    idle:      'Ожидание...',
    listening: 'Слушаю...',
    speaking:  'Говорю...',
};

// Microphone SVG icon (inline so we have zero external deps)
const MicIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Create AnalyserNode from a MediaStream and return a getter for the current RMS level (0–1). */
function createAudioAnalyser(stream) {
    const ctx      = new (window.AudioContext || window.webkitAudioContext)();
    const source   = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);

    function getLevel() {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
        }
        return Math.min(1, Math.sqrt(sum / buffer.length) * 3); // amplify a bit
    }

    function dispose() {
        source.disconnect();
        ctx.close().catch(() => {});
    }

    return { getLevel, dispose, context: ctx };
}

/** Speak text via Web Speech Synthesis and resolve when done. */
function speak(text) {
    return new Promise((resolve) => {
        if (!window.speechSynthesis || !text) { resolve(); return; }
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang  = 'ru-RU';
        utter.rate  = 1.0;
        utter.pitch = 1.0;
        utter.onend  = resolve;
        utter.onerror = resolve;
        window.speechSynthesis.speak(utter);
    });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoreView() {
    // State
    const [sphereState, setSphereState] = useState('idle');   // 'idle' | 'listening' | 'speaking'
    const [audioLevel, setAudioLevel]   = useState(0);
    const [messages, setMessages]       = useState([]);       // { role: 'user'|'assistant', text }
    const [inputText, setInputText]     = useState('');
    const [holdMode, setHoldMode]       = useState(true);     // true = push‑to‑talk, false = toggle

    // Refs
    const recognitionRef = useRef(null);
    const analyserRef    = useRef(null);
    const levelRafRef    = useRef(null);
    const chatEndRef     = useRef(null);
    const mediaStreamRef = useRef(null);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Audio level polling ───────────────────────────────────────────────────
    const startLevelPolling = useCallback(() => {
        function tick() {
            if (analyserRef.current) {
                setAudioLevel(analyserRef.current.getLevel());
            }
            levelRafRef.current = requestAnimationFrame(tick);
        }
        tick();
    }, []);

    const stopLevelPolling = useCallback(() => {
        if (levelRafRef.current) {
            cancelAnimationFrame(levelRafRef.current);
            levelRafRef.current = null;
        }
        setAudioLevel(0);
    }, []);

    // ── Start listening ───────────────────────────────────────────────────────
    const startListening = useCallback(async () => {
        setSphereState('listening');

        // Grab microphone for audioLevel analysis
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            analyserRef.current = createAudioAnalyser(stream);
            startLevelPolling();
        } catch (err) {
            console.warn('[CoreView] Microphone access denied:', err);
        }

        // Speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[CoreView] SpeechRecognition API not available');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang            = 'ru-RU';
        recognition.interimResults  = false;
        recognition.continuous      = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            if (!transcript) return;
            await handleCommand(transcript);
        };

        recognition.onerror = (event) => {
            console.warn('[CoreView] Recognition error:', event.error);
            stopListening();
        };

        recognition.onend = () => {
            // If toggle mode and user hasn't stopped manually, restart
            if (!holdMode && sphereState === 'listening') {
                try { recognition.start(); } catch (_) { /* already started */ }
            }
        };

        recognitionRef.current = recognition;
        try { recognition.start(); } catch (_) { /* */ }
    }, [holdMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Stop listening ────────────────────────────────────────────────────────
    const stopListening = useCallback(() => {
        // Stop recognition
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (_) { /* */ }
            recognitionRef.current = null;
        }

        // Stop analyser
        if (analyserRef.current) {
            analyserRef.current.dispose();
            analyserRef.current = null;
        }

        // Stop media stream tracks
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
        }

        stopLevelPolling();
        setSphereState('idle');
    }, [stopLevelPolling]);

    // ── Handle a user command (from voice or text) ────────────────────────────
    const handleCommand = useCallback(async (text) => {
        stopListening();

        // Add user message to chat
        setMessages((prev) => [...prev, { role: 'user', text }]);

        // Try IPC bridge first, fall back to echo
        let response = '';
        try {
            if (window.arcusAPI && typeof window.arcusAPI.processCommand === 'function') {
                response = await window.arcusAPI.processCommand(text);
            } else {
                response = `Команда получена: «${text}»`;
            }
        } catch (err) {
            response = `Ошибка обработки: ${err.message}`;
        }

        // Add assistant message
        setMessages((prev) => [...prev, { role: 'assistant', text: response }]);

        // Speak the response
        setSphereState('speaking');
        await speak(response);
        setSphereState('idle');
    }, [stopListening]);

    // ── Text input submit ─────────────────────────────────────────────────────
    const handleTextSubmit = useCallback((e) => {
        e.preventDefault();
        const trimmed = inputText.trim();
        if (!trimmed) return;
        setInputText('');
        handleCommand(trimmed);
    }, [inputText, handleCommand]);

    // ── Push‑to‑talk handlers ─────────────────────────────────────────────────
    const handleMicDown = useCallback(() => {
        if (holdMode) startListening();
    }, [holdMode, startListening]);

    const handleMicUp = useCallback(() => {
        if (holdMode && sphereState === 'listening') stopListening();
    }, [holdMode, sphereState, stopListening]);

    const handleMicClick = useCallback(() => {
        if (!holdMode) {
            if (sphereState === 'listening') {
                stopListening();
            } else {
                startListening();
            }
        }
    }, [holdMode, sphereState, startListening, stopListening]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            stopListening();
        };
    }, [stopListening]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="core-view">
            {/* ── Sphere area ─────────────────────────────────────────────── */}
            <div className="core-view__sphere-container">
                <ParticleSphere state={sphereState} audioLevel={audioLevel} />
                <StatusRing state={sphereState} audioLevel={audioLevel} size={420} />
            </div>

            {/* ── Status text ─────────────────────────────────────────────── */}
            <div className={`core-view__status core-view__status--${sphereState}`}>
                {STATUS_LABELS[sphereState]}
            </div>

            {/* ── Controls row ────────────────────────────────────────────── */}
            <div className="core-view__controls">
                {/* Push-to-talk / toggle button */}
                <button
                    className={`core-view__mic-btn ${sphereState === 'listening' ? 'core-view__mic-btn--active' : ''}`}
                    onMouseDown={handleMicDown}
                    onMouseUp={handleMicUp}
                    onMouseLeave={holdMode ? handleMicUp : undefined}
                    onClick={handleMicClick}
                    title={holdMode ? 'Удерживайте для записи' : 'Нажмите для начала/остановки записи'}
                    aria-label="Микрофон"
                >
                    <MicIcon />
                </button>

                {/* Mode toggle */}
                <button
                    className="core-view__mode-btn"
                    onClick={() => setHoldMode((m) => !m)}
                    title={holdMode ? 'Режим: удержание' : 'Режим: переключение'}
                >
                    {holdMode ? 'PTT' : 'TOG'}
                </button>
            </div>

            {/* ── Text input ──────────────────────────────────────────────── */}
            <form className="core-view__input-form" onSubmit={handleTextSubmit}>
                <input
                    className="core-view__input"
                    type="text"
                    placeholder="Введите команду..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                />
                <button className="core-view__send-btn" type="submit" aria-label="Отправить">
                    ▶
                </button>
            </form>

            {/* ── Chat log ────────────────────────────────────────────────── */}
            <div className="core-view__chat">
                {messages.length === 0 && (
                    <div className="core-view__chat-empty">
                        Скажите или напишите команду для A.R.C.U.S.
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`core-view__chat-msg core-view__chat-msg--${msg.role}`}>
                        <span className="core-view__chat-role">
                            {msg.role === 'user' ? 'Вы' : 'A.R.C.U.S.'}
                        </span>
                        <span className="core-view__chat-text">{msg.text}</span>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
        </div>
    );
}
