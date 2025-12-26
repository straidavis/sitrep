const { contextBridge } = require('electron');
const fs = require('fs');
const path = require('path');

// Determine config path
// In development, it's in the client root
// In production, we expect it next to the executable
let configPath;
if (process.env.NODE_ENV === 'development' || !process.isPackaged) {
    configPath = path.resolve(__dirname, '../spark-config.json');
} else {
    // Priority: 
    // 1. Portable EXE location (if running as portable)
    // 2. Next to the executable (if installed/unpacked)
    const basePath = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
    configPath = path.join(basePath, 'spark-config.json');
}

console.log('Looking for config at:', configPath);

let config = {
    serverUrl: "http://localhost:3001",
    authMode: "local"
};

try {
    if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        config = { ...config, ...parsed };
        console.log('Config loaded successfully');
    } else {
        console.warn('Config file not found, using defaults.');
    }
} catch (error) {
    console.error('Error reading config file:', error);
}

// Expose to Renderer
contextBridge.exposeInMainWorld('SPARK_CONFIG', config);
