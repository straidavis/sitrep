import foundryConfig from './foundry_config.json';

const env = import.meta.env;
const get = (key, fallback) => env[key] || fallback;

// Helper to inject RIDs into Objects
const injectObjectRids = (objects) => {
    const map = {
        flights: "VITE_OBJ_FLIGHTS_RID",
        deployments: "VITE_OBJ_DEPLOYMENTS_RID",
        equipment: "VITE_OBJ_EQUIPMENT_RID",
        inventory: "VITE_OBJ_INVENTORY_RID",
        kits: "VITE_OBJ_KITS_RID",
        kitItems: "VITE_OBJ_KIT_ITEMS_RID",
        partsCatalog: "VITE_OBJ_PARTS_CATALOG_RID",
        partsUtilization: "VITE_OBJ_PARTS_UTILIZATION_RID",
        serviceBulletins: "VITE_OBJ_SERVICE_BULLETINS_RID",
        shipmentItems: "VITE_OBJ_SHIPMENT_ITEMS_RID",
        shipping: "VITE_OBJ_SHIPPING_RID"
    };

    const newObjects = { ...objects };
    for (const [key, envVar] of Object.entries(map)) {
        if (newObjects[key]) {
            newObjects[key] = {
                ...newObjects[key],
                rid: get(envVar, newObjects[key].rid)
            };
        }
    }
    return newObjects;
};

// Map Datasets
const datasets = { ...foundryConfig.DATASETS };
const datasetMap = {
    flights: "VITE_DS_FLIGHTS_RID",
    equipment: "VITE_DS_EQUIPMENT_RID",
    deployments: "VITE_DS_DEPLOYMENTS_RID",
    inventory: "VITE_DS_INVENTORY_RID",
    parts_utilization: "VITE_DS_PARTS_UTILIZATION_RID",
    kits: "VITE_DS_KITS_RID",
    shipping: "VITE_DS_SHIPPING_RID",
    service_bulletins: "VITE_DS_SERVICE_BULLETINS_RID",
    shipment_items: "VITE_DS_SHIPMENT_ITEMS_RID",
    kit_items: "VITE_DS_KIT_ITEMS_RID",
    parts_catalog: "VITE_DS_PARTS_CATALOG_RID",
    users: "VITE_DS_USERS_RID"
};
for (const [key, envVar] of Object.entries(datasetMap)) {
    datasets[key] = get(envVar, datasets[key]);
}

const getAuthMode = () => {
    // 1. Env Overrides (CLI flags)
    if (env.VITE_AUTH_MODE && env.VITE_AUTH_MODE !== "") {
        return env.VITE_AUTH_MODE;
    }
    // 2. Config File
    if (foundryConfig.AUTH?.TYPE) {
        return foundryConfig.AUTH.TYPE;
    }
    // 3. Fallback to Env default or 'local'
    return env.VITE_AUTH_MODE || 'microsoft'; // Defaulting to microsoft per user request for local dev
};

const authMode = getAuthMode();

const defaults = {
    serverUrl: env.VITE_API_URL || "http://localhost:3001",
    authMode: authMode, // 'local' or 'microsoft'
    apiKey: env.VITE_API_KEY || "", // For legacy/local auth
    m365: {
        clientId: foundryConfig.AUTH?.CLIENT_ID || env.VITE_AZURE_CLIENT_ID || "",
        tenantId: foundryConfig.AUTH?.TENANT_ID || env.VITE_AZURE_TENANT_ID || "",
        redirectUri: foundryConfig.AUTH?.REDIRECT_URI || window.location.origin,
        clientSecret: env.VITE_AZURE_CLIENT_SECRET || "",
        hostUrl: foundryConfig.AUTH?.HOST_URL || window.location.origin,
        authorizedDomains: foundryConfig.AUTH?.AUTHORIZED_DOMAINS || []
    },
    defaultAdmin: "matt.davis@shield.ai",
    // Foundry Config integration
    foundry: {
        url: foundryConfig.FOUNDRY_URL,
        token: get('VITE_FOUNDRY_TOKEN', foundryConfig.FOUNDRY_TOKEN),
        samplesFolderRid: get('VITE_FOUNDRY_SAMPLES_FOLDER_RID', foundryConfig.FOUNDRY_SAMPLES_FOLDER_RID),
        datasets: datasets,
        defaultBranch: foundryConfig.DEFAULT_BRANCH || 'master'
    }
};

const ontology = { ...foundryConfig.ONTOLOGY };
ontology.RID = get('VITE_ONTOLOGY_RID', ontology.RID);
if (ontology.OBJECTS) {
    ontology.OBJECTS = injectObjectRids(ontology.OBJECTS);
}

// In Electron, config is injected via preload into window.SITREP_CONFIG
// In Browser (Dev), we use defaults (or you could fetch /config.json if served)
export const config = {
    ...defaults,
    ONTOLOGY: ontology,
    OBJECT_TYPES: foundryConfig.OBJECT_TYPES, // Keep for backward compat if needed
    ...(window.SPARK_CONFIG || {})
};

console.log("SPARK Config Loaded:", config);
