import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ParticleSphere from '../components/ParticleSphere';
import '../styles/core-view.css';

/**
 * Play a futuristic boot-up audio sweep using Web Audio API.
 */
function playBootChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(220, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.35);

    osc2.frequency.setValueAtTime(440, now);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.45);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.85);
    osc2.stop(now + 0.85);

    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch (_) {}
}

/**
 * Get greeting message based on current hour of day.
 */
function getStartupGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Доброе утро, сэр. Ядро A.R.C.U.S. активировано. Системы готовы к работе. Чем займёмся?';
  } else if (hour >= 12 && hour < 18) {
    return 'Добрый день. Протоколы контроля и ассистент A.R.C.U.S. в сети. Все узлы функционируют штатно.';
  } else if (hour >= 18 && hour < 23) {
    return 'Добрый вечер, сэр. Система A.R.C.U.S. активна. Жду ваших указаний.';
  } else {
    return 'Ночной протокол активирован. Я на связи и готов выполнить любую команду.';
  }
}

// Quick interactive chips
const QUICK_SUGGESTIONS = [
  '💬 О чем ты думаешь?',
  '🎵 Включи музыку на ютубе',
  '🎮 Открой стим',
  '💡 Расскажи шутку',
  '🎬 Посоветуй фильм',
  '📝 Открой блокнот и запиши идею',
];

export default function CoreView({ addLog }) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [response, setResponse] = useState(null);
  const [sphereState, setSphereState] = useState('idle'); // 'idle' | 'listening' | 'speaking'
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const speechAnimRef = useRef(null);
  const hasBootedRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const latestTranscriptRef = useRef('');

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Smooth speech animation using continuous harmonic wave on RAF
  const startSmoothSpeechCadence = useCallback(() => {
    if (speechAnimRef.current) cancelAnimationFrame(speechAnimRef.current);
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = (now - startTime) / 1000;
      const wave =
        Math.sin(elapsed * 4.6) * 0.22 +
        Math.sin(elapsed * 9.2) * 0.12 +
        Math.sin(elapsed * 2.1) * 0.16 +
        0.48;
      setAudioLevel(Math.max(0.12, Math.min(0.85, wave)));
      speechAnimRef.current = requestAnimationFrame(tick);
    };

    speechAnimRef.current = requestAnimationFrame(tick);
  }, []);

  const stopSmoothSpeechCadence = useCallback(() => {
    if (speechAnimRef.current) {
      cancelAnimationFrame(speechAnimRef.current);
      speechAnimRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Speak response using Web Speech Synthesis
  const speakText = useCallback(
    (text) => {
      if (!window.speechSynthesis || !text) return;
      window.speechSynthesis.cancel();

      const cleanText = text.replace(/[•\n]/g, ' ').replace(/\s+/g, ' ').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ru-RU';
      utterance.rate = 1.05;

      setSphereState('speaking');
      startSmoothSpeechCadence();

      const onFinish = () => {
        stopSmoothSpeechCadence();
        setSphereState('idle');
      };

      utterance.onend = onFinish;
      utterance.onerror = onFinish;

      window.speechSynthesis.speak(utterance);
    },
    [startSmoothSpeechCadence, stopSmoothSpeechCadence]
  );

  // Execute a single resolved action
  const executeSingleAction = useCallback(async (actionItem) => {
    let execResult = { success: true };

    switch (actionItem.action) {
      case 'greeting':
      case 'calc-eval':
      case 'ai-thought':
        break;

      case 'open-steam':
        execResult = await window.arcusAPI?.system.openSteam(actionItem.target);
        break;

      case 'compound-notepad':
        execResult = await window.arcusAPI?.system.createNoteAndOpen(actionItem.target);
        break;

      case 'compound-calc':
        execResult = await window.arcusAPI?.system.openApp('calc.exe');
        break;

      case 'open-url':
      case 'search-youtube':
        execResult = await window.arcusAPI?.system.openUrl(actionItem.target);
        break;

      case 'launch-app':
        execResult = await window.arcusAPI?.system.openApp(actionItem.target);
        break;

      case 'launch-game':
        if (actionItem.target.startsWith('steam://')) {
          execResult = await window.arcusAPI?.system.openSteam(actionItem.target);
        } else {
          execResult = await window.arcusAPI?.system.openSteam(`steam://run/${encodeURIComponent(actionItem.target)}`);
        }
        break;

      case 'open-folder':
        execResult = await window.arcusAPI?.system.openFolder(actionItem.target);
        break;

      case 'control-volume':
        if (actionItem.params?.level !== undefined) {
          execResult = await window.arcusAPI?.system.setVolume(actionItem.params.level);
        }
        break;

      default:
        execResult = { success: false, error: `Неизвестное действие: ${actionItem.action}` };
    }

    return execResult;
  }, []);

  // Process a command (from text or voice)
  const executeCommand = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || isProcessing) return;

      setIsProcessing(true);
      setResponse(null);

      try {
        const result = await window.arcusAPI?.processCommand(trimmed);

        if (result?.success && result.permitted) {
          let overallSuccess = true;
          let feedbackMessage = result.message;

          if (result.action === 'chained' && Array.isArray(result.params?.steps)) {
            for (const step of result.params.steps) {
              const stepRes = await executeSingleAction(step);
              if (!stepRes?.success) overallSuccess = false;
              await new Promise((r) => setTimeout(r, 350));
            }
          } else {
            const singleRes = await executeSingleAction(result);
            if (!singleRes?.success) {
              overallSuccess = false;
              feedbackMessage = singleRes?.error || 'Ошибка при выполнении действия';
            }
          }

          setResponse({
            type: overallSuccess ? 'success' : 'error',
            message: feedbackMessage,
          });
          speakText(feedbackMessage);

          addLog?.({
            command: trimmed,
            action: result.action,
            target: result.target,
            status: overallSuccess ? 'success' : 'error',
            error: overallSuccess ? undefined : feedbackMessage,
          });
        } else {
          const errMsg = result?.error || 'Команда не распознана';
          setResponse({
            type: 'error',
            message: errMsg,
          });
          speakText(errMsg);

          addLog?.({
            command: trimmed,
            action: result?.action || 'unknown',
            target: result?.target || '',
            status: 'blocked',
            error: result?.error,
          });
        }
      } catch (err) {
        const errText = `Ошибка: ${err.message}`;
        setResponse({
          type: 'error',
          message: errText,
        });
        speakText(errText);

        addLog?.({
          command: trimmed,
          action: 'error',
          target: '',
          status: 'error',
          error: err.message,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, addLog, speakText, executeSingleAction]
  );

  // ─── Startup Awakening on mount ──────────────────────────────
  useEffect(() => {
    if (hasBootedRef.current) return;
    hasBootedRef.current = true;

    const timer = setTimeout(() => {
      playBootChime();
      const greeting = getStartupGreeting();
      setResponse({
        type: 'success',
        message: greeting,
      });
      speakText(greeting);
    }, 600);

    return () => clearTimeout(timer);
  }, [speakText]);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const text = input;
      setInput('');
      executeCommand(text);
    },
    [input, executeCommand]
  );

  // Stop recording & cleanup
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setSphereState('idle');

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setAudioLevel(0);

    // If we gathered a transcript, execute it!
    const finalTxt = latestTranscriptRef.current.trim();
    if (finalTxt) {
      latestTranscriptRef.current = '';
      setInput('');
      executeCommand(finalTxt);
    }
  }, [executeCommand]);

  // Start recording (Toggle mode — stays ON until you click again or finish speaking)
  const startRecording = useCallback(async () => {
    setIsRecording(true);
    setSphereState('listening');
    latestTranscriptRef.current = '';

    // 1. Microphone level meter (visual audio feedback)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.min(1, Math.sqrt(sum / buffer.length) * 3.8);
        setAudioLevel(rms);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.warn('Microphone stream access error:', err);
    }

    // 2. Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        if (currentText) {
          latestTranscriptRef.current = currentText;
          setInput(currentText);

          // Reset silence timer on speech
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            stopRecording();
          }, 2000); // Auto-submit after 2 seconds of silence
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition warning:', event.error);
        if (event.error !== 'no-speech') {
          if (event.error === 'network') {
            setResponse({
              type: 'error',
              message: 'Голосовому модулю Chromium требуется Google API Key для отправки аудио на сервера распознавания.\nВ разделе Настроек добавлено специальное поле и пошаговая инструкция!',
              showSettingsLink: true,
            });
          }
          stopRecording();
        }
      };

      recognition.onend = () => {
        // If recognition closed but user has typed/spoken, submit
        if (latestTranscriptRef.current.trim()) {
          stopRecording();
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        console.warn('Recognition start exception:', err);
      }
    } else {
      setResponse({
        type: 'error',
        message: 'SpeechRecognition API не поддерживается в данной сборке Chromium.',
      });
    }
  }, [stopRecording]);

  // Click handler: Toggle listening on/off
  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div
      className="core-view"
      style={{
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '100%',
        padding: '12px 24px 18px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* 3D Dense Particle Sphere with Dynamic Glow */}
      <div
        className="sphere-container"
        style={{
          position: 'relative',
          width: '100%',
          flex: '1',
          minHeight: '340px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at center, rgba(0, 212, 255, 0.12) 0%, rgba(0, 50, 100, 0.04) 40%, #000000 70%)',
        }}
      >
        <ParticleSphere state={sphereState} audioLevel={audioLevel} />
      </div>

      {/* Response display */}
      {response && (
        <div
          className={`response-bubble ${response.type}`}
          style={{
            whiteSpace: 'pre-line',
            backgroundColor: 'rgba(6, 6, 12, 0.95)',
            border: `1px solid ${response.type === 'error' ? 'rgba(255, 68, 102, 0.4)' : 'rgba(0, 212, 255, 0.35)'}`,
            boxShadow: `0 0 25px ${response.type === 'error' ? 'rgba(255, 68, 102, 0.18)' : 'rgba(0, 212, 255, 0.18)'}`,
            color: '#e8e8f2',
            maxWidth: '850px',
            width: '92%',
            marginBottom: '10px',
            padding: '12px 18px',
            borderRadius: '10px',
            fontSize: '14px',
            lineHeight: '1.5',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div>{response.message}</div>
          {response.showSettingsLink && (
            <button
              type="button"
              onClick={() => navigate('/settings')}
              style={{
                marginTop: '10px',
                backgroundColor: '#00d4ff',
                color: '#000000',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>⚙️</span> Открыть Настройки и подключить ключ
            </button>
          )}
        </div>
      )}

      {/* Interactive Quick Suggestions Chips */}
      <div
        className="quick-suggestions-row"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'center',
          width: '92%',
          maxWidth: '850px',
          marginBottom: '10px',
        }}
      >
        {QUICK_SUGGESTIONS.map((chip, idx) => {
          const cleanQuery = chip.replace(/^[^\s]+\s+/, '');
          return (
            <button
              key={idx}
              type="button"
              onClick={() => executeCommand(cleanQuery)}
              style={{
                background: 'rgba(0, 212, 255, 0.05)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                color: '#88e0ff',
                padding: '5px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)';
                e.currentTarget.style.borderColor = '#00d4ff';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 212, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.2)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Command input & Push/Toggle Microphone */}
      <form
        className="command-input-form"
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '92%',
          maxWidth: '850px',
        }}
      >
        {/* Toggle Microphone Button (Click to start / click to stop) */}
        <button
          type="button"
          className={`mic-button ${isRecording ? 'recording' : ''}`}
          onClick={handleMicClick}
          title={isRecording ? 'Идет запись... Нажмите для отправки' : 'Нажмите для голосового ввода'}
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: isRecording ? '#00ff88' : 'rgba(0, 212, 255, 0.08)',
            border: `2px solid ${isRecording ? '#00ff88' : '#00d4ff'}`,
            color: isRecording ? '#000000' : '#00d4ff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isRecording ? '0 0 25px #00ff88' : '0 0 12px rgba(0, 212, 255, 0.25)',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        <div
          className={`command-input-wrapper ${isProcessing ? 'processing' : ''}`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#050508',
            border: isRecording ? '1px solid #00ff88' : '1px solid rgba(0, 212, 255, 0.25)',
            boxShadow: isRecording ? '0 0 15px rgba(0, 255, 136, 0.2)' : '0 0 15px rgba(0, 212, 255, 0.06)',
            borderRadius: '10px',
            padding: '4px 12px',
            transition: 'all 0.3s ease',
          }}
        >
          <span className="command-prompt" style={{ color: isRecording ? '#00ff88' : '#00d4ff', marginRight: '10px', fontSize: '16px' }}>{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            className="command-input"
            placeholder={isRecording ? 'Слушаю вас... Говорите в микрофон' : '«открой ютуб и включи клип yeat - out the way», «в чем смысл жизни?»...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isProcessing}
            autoComplete="off"
            spellCheck="false"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '14px',
              padding: '10px 0',
            }}
          />
          <button
            type="submit"
            className="command-submit"
            disabled={!input.trim() || isProcessing}
            style={{
              background: 'none',
              border: 'none',
              color: input.trim() ? '#00d4ff' : '#444455',
              cursor: input.trim() ? 'pointer' : 'default',
              fontSize: '18px',
              padding: '0 8px',
              transition: 'color 0.2s',
            }}
          >
            {isProcessing ? '...' : '→'}
          </button>
        </div>
      </form>
    </div>
  );
}
