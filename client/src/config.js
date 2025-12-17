const defaults = {
    serverUrl: "http://localhost:3001",
    authMode: "local",
    m365: {
        clientId: "",
        tenantId: "",
        redirectUri: "http://localhost:5173"
    },
    defaultAdmin: "matt.davis@shield.ai"
};

// In Electron, config is injected via preload into window.SITREP_CONFIG
// In Browser (Dev), we use defaults (or you could fetch /config.json if served)
export const config = {
    ...defaults,
    ...(window.SITREP_CONFIG || {})
};

console.log("SITREP Config Loaded:", config);
