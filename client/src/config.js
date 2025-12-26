const defaults = {
    serverUrl: import.meta.env.VITE_API_URL || "http://localhost:3001",
    authMode: import.meta.env.VITE_AUTH_MODE || "local", // 'local' or 'microsoft'
    apiKey: import.meta.env.VITE_API_KEY || "", // For legacy/local auth
    m365: {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "",
        tenantId: import.meta.env.VITE_AZURE_TENANT_ID || "",
        redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin
    },
    defaultAdmin: "matt.davis@shield.ai"
};

// In Electron, config is injected via preload into window.SITREP_CONFIG
// In Browser (Dev), we use defaults (or you could fetch /config.json if served)
export const config = {
    ...defaults,
    ...(window.SPARK_CONFIG || {})
};

console.log("SPARK Config Loaded:", config);
