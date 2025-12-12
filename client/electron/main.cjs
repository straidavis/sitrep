const { app, BrowserWindow } = require('electron');
const path = require('path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        icon: path.join(__dirname, '../public/uscg-logo.svg'), // Note: SVGs might not work as window icons on all OS, usually ICO/PNG preferred
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: "Aircraft Materiel Condition Report"
    });

    // Check if we are in dev mode (env var or argument)
    const isDev = !app.isPackaged;

    if (isDev) {
        // In dev, load the vite dev server
        mainWindow.loadURL('http://localhost:3000');
        // Open the DevTools.
        mainWindow.webContents.openDevTools();
    } else {
        // In prod, load the built index.html
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Remove menu for production feel
    if (!isDev) {
        mainWindow.setMenu(null);
    }
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
