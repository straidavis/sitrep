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
        center: true,
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

let serverProcess;

const startServer = () => {
    const isDev = !app.isPackaged;
    let scriptPath;

    if (isDev) {
        scriptPath = path.join(__dirname, '../../server/index.js');
    } else {
        // In production, we expect 'server' folder to be in resources
        scriptPath = path.join(process.resourcesPath, 'server/index.js');
    }

    const dbPath = path.join(app.getPath('userData'), 'sitrep_database.sqlite');
    console.log(`Starting server from: ${scriptPath}`);
    console.log(`Database path: ${dbPath}`);

    const { fork } = require('child_process');

    // Check if script exists
    const fs = require('fs');
    if (!fs.existsSync(scriptPath)) {
        console.error('Server script not found at:', scriptPath);
        return;
    }

    serverProcess = fork(scriptPath, [], {
        env: { ...process.env, DB_PATH: dbPath, PORT: 3001, NODE_ENV: isDev ? 'development' : 'production' },
        stdio: 'inherit'
    });

    serverProcess.on('message', (msg) => {
        console.log('Server message:', msg);
    });

    serverProcess.on('error', (err) => {
        console.error('Server process error:', err);
    });
};

app.on('ready', () => {
    startServer();
    createWindow();
});

app.on('before-quit', () => {
    if (serverProcess) {
        console.log('Killing server process...');
        serverProcess.kill();
    }
});

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
