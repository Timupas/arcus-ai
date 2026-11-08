/**
 * A.R.C.U.S. Command Processor
 * ─────────────────────────────
 * Smart Natural Language Intent Processor for single, compound,
 * and chained commands in Russian and English.
 */

const { isActionAllowed } = require('./security');
const { generateAIResponse } = require('./ai-brain');

// Known application aliases
const APP_ALIASES = {
  'блокнот': 'notepad.exe',
  'notepad': 'notepad.exe',
  'калькулятор': 'calc.exe',
  'calculator': 'calc.exe',
  'calc': 'calc.exe',
  'проводник': 'explorer.exe',
  'explorer': 'explorer.exe',
  'диспетчер задач': 'taskmgr.exe',
  'task manager': 'taskmgr.exe',
  'пейнт': 'mspaint.exe',
  'paint': 'mspaint.exe',
  'хром': 'chrome',
  'chrome': 'chrome',
  'гугл хром': 'chrome',
  'яндекс': 'yandex',
  'яндекс браузер': 'yandex',
  'браузер': 'https://google.com',
  'browser': 'https://google.com',
  'стим': 'steam://open/main',
  'steam': 'steam://open/main',
  'дискорд': 'discord',
  'discord': 'discord',
  'телеграм': 'telegram',
  'telegram': 'telegram',
  'тг': 'telegram',
  'вс код': 'code',
  'vs code': 'code',
  'vscode': 'code',
};

// Popular Steam games mapped to their Steam App IDs
const STEAM_GAMES = {
  'дота': '570',
  'доту': '570',
  'дота 2': '570',
  'доту 2': '570',
  'dota': '570',
  'dota 2': '570',
  'кс': '730',
  'кс2': '730',
  'кс 2': '730',
  'cs': '730',
  'cs2': '730',
  'cs:go': '730',
  'counter-strike': '730',
  'counter strike': '730',
  'раст': '252490',
  'rust': '252490',
  'пабг': '578080',
  'pubg': '578080',
  'гта': '271590',
  'гта 5': '271590',
  'гта5': '271590',
  'gta': '271590',
  'gta 5': '271590',
  'ведьмак': '292030',
  'ведьмак 3': '292030',
  'witcher': '292030',
  'witcher 3': '292030',
  'киберпанк': '1091500',
  'cyberpunk': '1091500',
  'cyberpunk 2077': '1091500',
  'тф2': '440',
  'tf2': '440',
  'апекс': '1172470',
  'apex': '1172470',
};

// Safe math expression evaluator
function evaluateMath(expression) {
  try {
    const sanitized = expression
      .replace(/,/g, '.')
      .replace(/[xх]/gi, '*')
      .replace(/[^0-9+\-*/().%\s]/g, '');

    if (!sanitized.trim()) return null;
    const result = Function('"use strict"; return (' + sanitized + ')')();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.round(result * 1000) / 1000;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── 1. Smart Intent: YouTube Search & Video Playback ───────────
function parseYouTubeIntent(text) {
  const trimmed = text.trim();
  const hasYouTube = /(?:ютуб|youtube)/i.test(trimmed);
  const hasVideoWord = /(?:клип|видео|видос|песн|трек|музык|clip|video|track|song)/i.test(trimmed);
  const hasAction = /(?:включи|найди|поставь|покажи|запусти|поищи|поиск|search|find|play)/i.test(trimmed);

  // If input is purely "открой ютуб"
  if (/^(?:открой|запусти)\s+(?:ютуб|youtube)$/i.test(trimmed)) {
    return {
      action: 'open-url',
      target: 'https://www.youtube.com',
      params: {},
      message: 'Открываю главную страницу YouTube...',
      requiresConfirmation: false,
      permitted: isActionAllowed('open-url'),
      raw: trimmed,
    };
  }

  // Any expression combining YouTube or Video playing intent
  if (hasYouTube || (hasVideoWord && hasAction)) {
    let query = trimmed;

    // Remove opening phrases like "открой браузер и", "открой ютуб и", "запусти хром и"
    query = query.replace(/^(?:открой|запусти)\s+(?:браузер|хром|гугл|яндекс|chrome|browser)\s+(?:и\s+)?/i, '');
    query = query.replace(/^(?:открой|запусти)\s+(?:ютуб|youtube)\s+(?:и\s+)?/i, '');

    // Remove contextual location like "там в ютубе", "в ютубе", "на ютубе", "там ютуб"
    query = query.replace(/(?:там\s+)?(?:в\s+|на\s+)?(?:ютубе|ютуб|youtube)\s*/gi, '');

    // Remove action verbs
    query = query.replace(/^(?:и\s+)?(?:включи|найди|поставь|покажи|запусти|поищи|поиск|search|find|play)\s*/i, '');

    // Remove video type indicators
    query = query.replace(/^(?:видео|видос|клип|песню|песня|трек|музыку|музыка|clip|video|track|song)\s*/i, '');

    // Clean outer quotes and brackets
    query = query.replace(/^["'«“]/, '').replace(/["'»”]$/, '').trim();

    if (!query) {
      return {
        action: 'open-url',
        target: 'https://www.youtube.com',
        params: {},
        message: 'Открываю YouTube...',
        requiresConfirmation: false,
        permitted: isActionAllowed('open-url'),
        raw: trimmed,
      };
    }

    return {
      action: 'search-youtube',
      target: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      params: { query },
      message: `Открываю YouTube и запускаю: «${query}»...`,
      requiresConfirmation: false,
      permitted: isActionAllowed('search-youtube') || isActionAllowed('open-url'),
      raw: trimmed,
    };
  }

  return null;
}

// ─── 2. Smart Intent: Browser & Web Search ───────────────────────
function parseBrowserSearchIntent(text) {
  const trimmed = text.trim();

  // "открой браузер и найди [запрос]"
  const pattern1 = /(?:открой|запусти)\s+(?:браузер|хром|гугл|яндекс|chrome|browser)\s+и\s+(?:найди|поищи|погугли|вбей|поиск)\s*(?:в\s+интернете\s+)?(.+)/i;
  // "найди в гугле/яндексе/интернете [запрос]"
  const pattern2 = /(?:найди|поищи|погугли|поиск)\s+(?:в\s+)?(?:гугле|яндексе|интернете|сети|браузере|google)\s*(.+)/i;

  let query = null;
  const m1 = trimmed.match(pattern1);
  if (m1) query = m1[1];
  else {
    const m2 = trimmed.match(pattern2);
    if (m2) query = m2[1];
  }

  if (query) {
    const cleanQuery = query.replace(/^["'«“]/, '').replace(/["'»”]$/, '').trim();
    return {
      action: 'open-url',
      target: `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`,
      params: { query: cleanQuery },
      message: `Открываю браузер и ищу: «${cleanQuery}»...`,
      requiresConfirmation: false,
      permitted: isActionAllowed('open-url'),
      raw: trimmed,
    };
  }

  return null;
}

// ─── 3. Smart Intent: Steam & Games ────────────────────────────
function parseSteamIntent(text) {
  const trimmed = text.trim();

  // "открой стим"
  if (/^(?:открой|запусти|включи|start|launch|open|run)\s+(?:стим|steam)$/i.test(trimmed) || /^(?:стим|steam)$/i.test(trimmed)) {
    return {
      action: 'open-steam',
      target: 'steam://open/main',
      params: {},
      message: 'Запускаю Steam...',
      requiresConfirmation: false,
      permitted: isActionAllowed('open-steam'),
      raw: trimmed,
    };
  }

  // "открой стим и установи [игра]"
  const installMatch = trimmed.match(/(?:открой|запусти)\s+(?:стим|steam)\s+и\s+(?:установи|скачай|загрузи)\s+(.+)/i);
  if (installMatch) {
    const game = installMatch[1].trim().toLowerCase();
    const appId = STEAM_GAMES[game];
    if (appId) {
      return {
        action: 'open-steam',
        target: `steam://install/${appId}`,
        params: { appId, game },
        message: `Открываю Steam и начинаю установку «${installMatch[1].trim()}» (AppID: ${appId})...`,
        requiresConfirmation: false,
        permitted: isActionAllowed('open-steam'),
        raw: trimmed,
      };
    }
    return {
      action: 'open-url',
      target: `https://store.steampowered.com/search/?term=${encodeURIComponent(game)}`,
      params: { game },
      message: `Открываю Steam Магазин и ищу: «${installMatch[1].trim()}»...`,
      requiresConfirmation: false,
      permitted: isActionAllowed('open-url'),
      raw: trimmed,
    };
  }

  // "открой стим и запусти [игра]" or "запусти [игра] в стиме"
  const runMatch = trimmed.match(/(?:открой|запусти)\s+(?:стим|steam)\s+и\s+(?:запусти|включи|сыграй\s+в|играй\s+в)\s+(.+)/i)
    || trimmed.match(/(?:запусти|открой|сыграй\s+в)\s+(.+)\s+в\s+стиме/i)
    || trimmed.match(/^(?:запусти|включи|сыграй\s+в)\s+(?:игру\s+)?(доту|дота|кс|кс2|пабг|раст|гта|ведьмак)/i);

  if (runMatch) {
    const gameRaw = runMatch[1].trim();
    const gameKey = gameRaw.toLowerCase();
    const appId = STEAM_GAMES[gameKey];
    if (appId) {
      return {
        action: 'open-steam',
        target: `steam://run/${appId}`,
        params: { appId, game: gameRaw },
        message: `Открываю Steam и запускаю «${gameRaw}»...`,
        requiresConfirmation: false,
        permitted: isActionAllowed('open-steam'),
        raw: trimmed,
      };
    }
    return {
      action: 'open-steam',
      target: `steam://open/games`,
      params: { game: gameRaw },
      message: `Открываю библиотеку Steam для запуска «${gameRaw}»...`,
      requiresConfirmation: false,
      permitted: isActionAllowed('open-steam'),
      raw: trimmed,
    };
  }

  return null;
}

// ─── 4. Smart Intent: Notepad Notes ────────────────────────────
function parseNotepadIntent(text) {
  const trimmed = text.trim();
  const m = trimmed.match(/(?:открой|запусти)\s+(?:блокнот|notepad)\s+и\s+(?:напиши|запиши|сохрани|вставь)\s*(?:текст\s+|заметку\s+)?(.+)/i);
  if (m) {
    const noteText = m[1].trim();
    return {
      action: 'compound-notepad',
      target: noteText,
      params: { text: noteText },
      message: `Создаю заметку в Блокноте с текстом: «${noteText.slice(0, 45)}${noteText.length > 45 ? '...' : ''}»`,
      requiresConfirmation: false,
      permitted: isActionAllowed('launch-app'),
      raw: trimmed,
    };
  }
  return null;
}

// ─── 5. Smart Intent: Calculator & Math ─────────────────────────
function parseCalcIntent(text) {
  const trimmed = text.trim();

  // "открой калькулятор и посчитай [expr]"
  const m1 = trimmed.match(/(?:открой|запусти)\s+(?:калькулятор|calc)\s+и\s+(?:посчитай|вычисли|реши|сколько\s+будет)\s*(.+)/i);
  if (m1) {
    const expr = m1[1].trim();
    const answer = evaluateMath(expr);
    return {
      action: 'compound-calc',
      target: 'calc.exe',
      params: { expression: expr, answer },
      message: answer !== null
        ? `Результат: ${expr} = ${answer}. Открываю калькулятор...`
        : `Открываю калькулятор для вычисления «${expr}»...`,
      requiresConfirmation: false,
      permitted: isActionAllowed('launch-app'),
      raw: trimmed,
    };
  }

  // Just "посчитай [expr]"
  const m2 = trimmed.match(/^(?:посчитай|вычисли|сколько\s+будет)\s+(.+)/i);
  if (m2) {
    const expr = m2[1].trim();
    const val = evaluateMath(expr);
    if (val !== null) {
      return {
        action: 'calc-eval',
        target: String(val),
        params: { expression: expr, result: val },
        message: `${expr} = ${val}`,
        requiresConfirmation: false,
        permitted: true,
        raw: trimmed,
      };
    }
  }

  return null;
}

// ─── 6. Standard Single Action Patterns ─────────────────────────
const STANDARD_PATTERNS = [
  // Greetings
  {
    patterns: [
      /^(?:привет|здравствуй(?:те)?|добрый\s+(?:день|вечер|утро)|хай|салют|hello|hi|hey|greetings)$/i,
    ],
    action: 'greeting',
    extract: () => ({
      target: 'greeting',
      params: {},
      message: 'Приветствую! Я A.R.C.U.S. — ваша система управления ресурсами и ассистент. Чем могу помочь?',
    }),
  },
  {
    patterns: [
      /^(?:кто\s+ты|что\s+ты(?:\s+такое|\s+за\s+программа|\s+за\s+система)?|расскажи\s+о\s+себе|who\s+are\s+you|what\s+are\s+you)$/i,
    ],
    action: 'greeting',
    extract: () => ({
      target: 'about',
      params: {},
      message: 'Я A.R.C.U.S. — Automated Resource Control & User Support. Локальный помощник для управления системой, запуском приложений, YouTube, Steam и контроля безопасности.',
    }),
  },
  {
    patterns: [
      /^(?:что\s+ты\s+умеешь|помощь|команды|help|what\s+can\s+you\s+do)$/i,
    ],
    action: 'greeting',
    extract: () => ({
      target: 'help',
      params: {},
      message: 'Я умею:\n• Искать и включать видео: «открой ютуб и включи клип [название]»\n• Поиск в интернете: «открой браузер и найди [запрос]»\n• Steam: «открой стим и запусти доту / кс», «установи [игра]»\n• Блокнот: «открой блокнот и напиши список дел»\n• Калькулятор: «открой калькулятор и посчитай 125 * 8»\n• Звук: «громкость 50», «выключи звук»\n• Общение: спросите меня о науке, космосе, фильмах или о жизни!',
    }),
  },

  // Open URL directly
  {
    patterns: [
      /^(?:открой|перейди\s+на|запусти|open|go\s+to|navigate\s+to|browse)\s+(?:сайт\s+)?(https?:\/\/\S+)$/i,
      /^(?:открой|перейди\s+на|запусти|open|go\s+to)\s+(?:сайт\s+)?((?:www\.)\S+\.\S+)$/i,
      /^(?:открой|перейди\s+на|open|go\s+to)\s+(?:сайт\s+)?(\S+\.(?:com|org|net|io|dev|ru|gg|tv|me)(?:\/\S*)?)$/i,
    ],
    action: 'open-url',
    extract: (m) => {
      let url = m[1];
      if (!url.startsWith('http')) url = 'https://' + url;
      return {
        target: url,
        params: {},
        message: `Открываю ${url}...`,
      };
    },
  },

  // Volume control
  {
    patterns: [
      /^(?:поставь\s+|сделай\s+|установи\s+)?громкость\s+(?:на\s+)?(\d{1,3})\s*%?$/i,
      /^(?:set\s+)?volume\s+(?:to\s+)?(\d{1,3})$/i,
    ],
    action: 'control-volume',
    extract: (m) => {
      const level = Math.max(0, Math.min(100, parseInt(m[1], 10)));
      return {
        target: 'volume',
        params: { level },
        message: `Громкость установлена на ${level}%`,
      };
    },
  },
  {
    patterns: [
      /^(?:выключи|отключи|убери)\s+звук$/i,
      /^\b(без\s+звука|заглуши|mute)\b$/i,
    ],
    action: 'control-volume',
    extract: () => ({
      target: 'volume',
      params: { level: 0, mute: true },
      message: 'Звук отключен',
    }),
  },
  {
    patterns: [
      /^(?:включи|верни)\s+звук$/i,
      /^\b(unmute)\b$/i,
    ],
    action: 'control-volume',
    extract: () => ({
      target: 'volume',
      params: { unmute: true, level: 50 },
      message: 'Звук включен',
    }),
  },

  // Open folder
  {
    patterns: [
      /^(?:открой|покажи)\s+папку\s+(.+)$/i,
      /^(?:открой|покажи)\s+(?:загрузки|downloads|диск\s+[cdсd]|проводник)$/i,
    ],
    action: 'open-folder',
    extract: (m) => {
      const target = (m[1] || m[0].replace(/^(?:открой|покажи)\s+/i, '')).trim();
      return {
        target,
        params: {},
        message: `Открываю «${target}»`,
      };
    },
  },

  // Open Known Application
  {
    patterns: [
      /^(?:открой|запусти|включи|start|launch|open|run)\s+(?:приложение|программу|app\s+)?(калькулятор|блокнот|проводник|хром|стим|дискорд|диспетчер\s+задач|пейнт|браузер)$/i,
      /^(?:калькулятор|блокнот|проводник|хром|стим|дискорд)$/i,
    ],
    action: 'launch-app',
    extract: (m) => {
      const rawTarget = (m[1] || m[0]).trim().toLowerCase();
      const resolvedTarget = APP_ALIASES[rawTarget] || rawTarget;
      return {
        target: resolvedTarget,
        params: { originalName: rawTarget },
        message: `Запускаю «${rawTarget}»...`,
      };
    },
  },
];

/**
 * Main command processing engine.
 * Priority:
 *   1. Smart YouTube Intent (e.g. "открой ютуб и включи клип yeat - out the way")
 *   2. Smart Browser Search Intent (e.g. "открой браузер и найди рецепт")
 *   3. Smart Steam Intent
 *   4. Smart Notepad Intent
 *   5. Smart Calculator Intent
 *   6. Standard Single Commands (volume, folders, known apps)
 *   7. Chained multi-command execution
 *   8. Conversational AI Reasoning fallback (ai-brain)
 */
function processCommand(text) {
  if (!text || typeof text !== 'string') {
    return {
      action: 'unknown',
      target: '',
      params: {},
      requiresConfirmation: false,
      permitted: false,
      error: 'Пустая или неверная команда',
    };
  }

  const trimmed = text.trim();

  // 1. YouTube Intent
  const ytResult = parseYouTubeIntent(trimmed);
  if (ytResult) return ytResult;

  // 2. Browser Search Intent
  const browserResult = parseBrowserSearchIntent(trimmed);
  if (browserResult) return browserResult;

  // 3. Steam Intent
  const steamResult = parseSteamIntent(trimmed);
  if (steamResult) return steamResult;

  // 4. Notepad Intent
  const noteResult = parseNotepadIntent(trimmed);
  if (noteResult) return noteResult;

  // 5. Calculator Intent
  const calcResult = parseCalcIntent(trimmed);
  if (calcResult) return calcResult;

  // 6. Standard Single Patterns
  for (const group of STANDARD_PATTERNS) {
    for (const pattern of group.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const res = group.extract(match);
        const permitted = isActionAllowed(group.action);
        return {
          action: group.action,
          target: res.target,
          params: res.params || {},
          message: res.message || `Выполняю: ${res.target}`,
          requiresConfirmation: false,
          permitted,
          raw: trimmed,
        };
      }
    }
  }

  // 7. Multi-command Chaining (e.g. "выключи звук и запусти блокнот")
  const chainSeparators = /\s+(?:затем|а\s+потом|после\s+этого)\s+|\s+и\s+(?=(?:открой|запусти|включи|поставь|сделай|выключи|громкость))/i;
  const parts = trimmed.split(chainSeparators).map(p => p.trim()).filter(Boolean);

  if (parts.length > 1) {
    const steps = [];
    for (const part of parts) {
      const single = processCommand(part);
      if (single && single.action !== 'unknown' && single.action !== 'ai-thought') {
        steps.push(single);
      }
    }

    if (steps.length === parts.length && steps.length > 1) {
      return {
        action: 'chained',
        target: 'multiple',
        params: { steps },
        message: `Выполняю цепочку действий:\n${steps.map((s, i) => `${i + 1}. ${s.message}`).join('\n')}`,
        requiresConfirmation: false,
        permitted: steps.every(s => s.permitted),
        raw: trimmed,
      };
    }
  }

  // 8. Conversational AI Reasoning fallback (ai-brain)
  const aiAnswer = generateAIResponse(trimmed);
  return {
    action: 'ai-thought',
    target: 'dialogue',
    params: { query: trimmed },
    message: aiAnswer,
    requiresConfirmation: false,
    permitted: true,
    raw: trimmed,
  };
}

module.exports = { processCommand };
