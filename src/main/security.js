/**
 * A.R.C.U.S. Security & Sandbox Module
 * ─────────────────────────────────────
 * Controls which paths, actions, and commands are allowed.
 * Persists policy overrides via electron-store.
 */

const path = require('path');

// electron-store — lazy-loaded to avoid issues during early require
let store = null;
function getStore() {
  if (!store) {
    const Store = require('electron-store');
    store = new Store({
      name: 'arcus-security-policy',
      defaults: {
        allowedActions: [...DEFAULT_ALLOWED_ACTIONS],
        blockedCommands: [...DEFAULT_BLOCKED_COMMANDS],
        deniedPaths: [...DEFAULT_DENIED_PATHS_PATTERNS],
        customAllowedPaths: [],
      },
    });
  }
  return store;
}

// ─── Default denied paths (шаблоны, раскрываются при проверке) ─────
const userProfile = process.env.USERPROFILE || 'C:\\Users\\Default';

const DEFAULT_DENIED_PATHS_PATTERNS = [
  path.join(userProfile, 'Documents'),
  path.join(userProfile, 'Desktop'),
  path.join(userProfile, 'Downloads'),
  process.env.APPDATA || path.join(userProfile, 'AppData', 'Roaming'),
  process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local'),
  // Crypto wallets
  path.join(userProfile, 'AppData', 'Roaming', 'Ethereum'),
  path.join(userProfile, 'AppData', 'Roaming', 'Bitcoin'),
  path.join(userProfile, 'AppData', 'Roaming', 'Exodus'),
  path.join(userProfile, 'AppData', 'Roaming', 'Metamask'),
  // Browser profiles (credentials, cookies)
  path.join(userProfile, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
  path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data'),
  path.join(userProfile, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles'),
  // SSH / GPG keys
  path.join(userProfile, '.ssh'),
  path.join(userProfile, '.gnupg'),
  // Windows credentials
  'C:\\Windows\\System32\\config',
];

// ─── Default allowed actions ───────────────────────────────────
const DEFAULT_ALLOWED_ACTIONS = [
  'open-browser',
  'open-url',
  'launch-app',
  'control-volume',
  'open-steam',
  'search-youtube',
  'launch-game',
  'open-folder',
  'search-apps',
];

// ─── Dangerous commands blacklist ──────────────────────────────
const DEFAULT_BLOCKED_COMMANDS = [
  'del',
  'rmdir',
  'rd',
  'format',
  'reg delete',
  'reg add',
  'net user',
  'net localgroup',
  'takeown',
  'icacls',
  'cipher',
  'diskpart',
  'bcdedit',
  'schtasks',
  'powershell -enc',
  'powershell -encodedcommand',
  'cmd /c del',
  'cmd /c format',
  'shutdown',
  'taskkill',
  'wmic',
  'sc delete',
  'sc stop',
  'attrib',
  'cacls',
];

/**
 * Check whether a given filesystem path is allowed for access.
 * @param {string} targetPath — path to validate
 * @returns {boolean}
 */
function isPathAllowed(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return false;

  const s = getStore();
  const deniedPaths = s.get('deniedPaths', DEFAULT_DENIED_PATHS_PATTERNS);
  const customAllowed = s.get('customAllowedPaths', []);

  const normalizedTarget = path.resolve(targetPath).toLowerCase();

  // Check custom allowlist first (overrides deny list)
  for (const allowed of customAllowed) {
    const normalizedAllowed = path.resolve(allowed).toLowerCase();
    if (normalizedTarget === normalizedAllowed || normalizedTarget.startsWith(normalizedAllowed + path.sep)) {
      return true;
    }
  }

  // Check deny list
  for (const denied of deniedPaths) {
    const normalizedDenied = path.resolve(denied).toLowerCase();
    if (normalizedTarget === normalizedDenied || normalizedTarget.startsWith(normalizedDenied + path.sep)) {
      return false;
    }
  }

  return true;
}

/**
 * Check whether an action type is allowed.
 * @param {string} action — action identifier
 * @returns {boolean}
 */
function isActionAllowed(action) {
  if (!action || typeof action !== 'string') return false;
  const s = getStore();
  const allowed = s.get('allowedActions', DEFAULT_ALLOWED_ACTIONS);
  return allowed.includes(action);
}

/**
 * Check whether a shell command is safe to execute.
 * Scans against the blocked commands list (case-insensitive).
 * @param {string} cmd — command string
 * @returns {boolean}
 */
function isCommandSafe(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;

  const s = getStore();
  const blocked = s.get('blockedCommands', DEFAULT_BLOCKED_COMMANDS);
  const lowerCmd = cmd.toLowerCase().trim();

  // Check for pipe/chain attempts to smuggle dangerous commands
  const segments = lowerCmd.split(/[;&|]+/).map((seg) => seg.trim());

  for (const segment of segments) {
    for (const blocked_cmd of blocked) {
      const lowerBlocked = blocked_cmd.toLowerCase();
      // Match at beginning of segment or as standalone token
      if (segment === lowerBlocked || segment.startsWith(lowerBlocked + ' ')) {
        return false;
      }
    }
  }

  // Block redirect to sensitive files
  if (/>\s*[a-z]:\\windows/i.test(cmd) || />\s*[a-z]:\\users.*\\appdata/i.test(cmd)) {
    return false;
  }

  return true;
}

/**
 * Get the full current security policy.
 * @returns {object}
 */
function getSecurityPolicy() {
  const s = getStore();
  return {
    allowedActions: s.get('allowedActions', DEFAULT_ALLOWED_ACTIONS),
    blockedCommands: s.get('blockedCommands', DEFAULT_BLOCKED_COMMANDS),
    deniedPaths: s.get('deniedPaths', DEFAULT_DENIED_PATHS_PATTERNS),
    customAllowedPaths: s.get('customAllowedPaths', []),
  };
}

/**
 * Update (merge) the security policy.
 * Only the provided keys are updated; others remain unchanged.
 * @param {object} policy — partial policy object
 */
function updateSecurityPolicy(policy) {
  if (!policy || typeof policy !== 'object') {
    throw new Error('Invalid policy object');
  }

  const s = getStore();

  if (Array.isArray(policy.allowedActions)) {
    s.set('allowedActions', policy.allowedActions);
  }
  if (Array.isArray(policy.blockedCommands)) {
    s.set('blockedCommands', policy.blockedCommands);
  }
  if (Array.isArray(policy.deniedPaths)) {
    s.set('deniedPaths', policy.deniedPaths);
  }
  if (Array.isArray(policy.customAllowedPaths)) {
    s.set('customAllowedPaths', policy.customAllowedPaths);
  }
}

/**
 * Get stored API keys.
 */
function getApiKeys() {
  const s = getStore();
  return {
    googleApiKey: s.get('googleApiKey', process.env.GOOGLE_API_KEY || ''),
    groqApiKey: s.get('groqApiKey', process.env.GROQ_API_KEY || ''),
  };
}

/**
 * Save API keys and update runtime environment.
 */
function saveApiKeys(keys) {
  if (!keys || typeof keys !== 'object') return;
  const s = getStore();
  if (keys.googleApiKey !== undefined) {
    const val = (keys.googleApiKey || '').trim();
    s.set('googleApiKey', val);
    process.env.GOOGLE_API_KEY = val;
  }
  if (keys.groqApiKey !== undefined) {
    const val = (keys.groqApiKey || '').trim();
    s.set('groqApiKey', val);
    process.env.GROQ_API_KEY = val;
  }
}

module.exports = {
  isPathAllowed,
  isActionAllowed,
  isCommandSafe,
  getSecurityPolicy,
  updateSecurityPolicy,
  getApiKeys,
  saveApiKeys,
};
