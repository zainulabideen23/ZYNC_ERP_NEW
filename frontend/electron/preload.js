const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Window management
    openNewInvoiceWindow: () => ipcRenderer.invoke('new-invoice-window'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Platform info
    platform: process.platform,

    // IPC channels for future use
    send: (channel, data) => {
        const validChannels = ['print-invoice', 'backup-database', 'export-data'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, callback) => {
        const validChannels = ['print-complete', 'backup-complete', 'export-complete'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
    }
});
