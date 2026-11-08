const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arcusAPI', {
  system: {
    openUrl: (url) => ipcRenderer.invoke('system:open-url', url),
    openApp: (appPath) => ipcRenderer.invoke('system:open-app', appPath),
    openSteam: (subCommand) => ipcRenderer.invoke('system:open-steam', subCommand),
    createNoteAndOpen: (text) => ipcRenderer.invoke('system:create-note-and-open', text),
    openFolder: (folderPath) => ipcRenderer.invoke('system:open-folder', folderPath),
    setVolume: (level) => ipcRenderer.invoke('system:volume-set', level),
    getVolume: () => ipcRenderer.invoke('system:volume-get'),
    searchApps: (query) => ipcRenderer.invoke('system:search-apps', query),
    executeCommand: (cmd) => ipcRenderer.invoke('system:execute-command', cmd),
    transcribeAudio: (audioBase64) => ipcRenderer.invoke('system:transcribe-audio', audioBase64),
  },
  settings: {
    getApiKeys: () => ipcRenderer.invoke('settings:get-api-keys'),
    saveApiKeys: (keys) => ipcRenderer.invoke('settings:save-api-keys', keys),
  },
  security: {
    checkPermission: (action, target) => ipcRenderer.invoke('security:check-permission', action, target),
    getPolicy: () => ipcRenderer.invoke('security:get-policy'),
    updatePolicy: (policy) => ipcRenderer.invoke('security:update-policy', policy),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },
  processCommand: (text) => ipcRenderer.invoke('process-command', text),
});
