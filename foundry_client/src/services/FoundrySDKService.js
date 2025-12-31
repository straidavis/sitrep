import { createClient } from "@osdk/client";
import { config } from '../config.js';

/**
 * Service to interact with Foundry via @osdk/client
 * Replaces manual fetch implementation with official SDK.
 */
class FoundrySDKService {
    constructor() {
        // Use full URL for createClient
        const url = config.foundry?.url || "https://shieldai.palantirfoundry.com";
        const token = config.foundry?.token;

        // New Config Structure Support
        const ontologyConfig = config.ONTOLOGY || {};
        this.ontologyRid = ontologyConfig.RID || config.FOUNDRY_ONTOLOGY_RID;
        this.ontologyObjects = ontologyConfig.OBJECTS || {};
        this.datasets = config.foundry?.datasets || {};
        this.baseUrl = url;
        this.token = token; // Actions config moved to Ontology Object config


        if (!token) console.error("Foundry Token NOT configured!");
        if (!this.ontologyRid) console.error("Ontology RID NOT configured!");

        console.log(`[SDK] Initializing OSDK Client with TokenProvider for: ${url}`);

        const tokenProvider = async () => {
            if (!token) throw new Error("Token not available");
            return token.trim();
        };

        try {
            // Attempt creation with explicit RID
            this.client = createClient(url, this.ontologyRid, tokenProvider);
            console.log("[SDK] Ontology Client Created (url, rid, tokenProvider).");
        } catch (e) {
            console.error("[SDK] Client creation failed.", e);
        }

        if (this.client) {
            window.FOUNDRY_CLIENT_DEBUG = this.client;
            console.log("[SDK] Client Keys:", Object.keys(this.client));

            // Debug Action Availability
            if (this.client.ontology) {
                console.log("[SDK] Client.ontology Keys:", Object.keys(this.client.ontology));
                if (this.client.ontology.actions) {
                    console.log("[SDK] Client.ontology.actions Keys:", Object.keys(this.client.ontology.actions));
                }
            }
            if (this.client.actions) {
                console.log("[SDK] Client.actions Keys:", Object.keys(this.client.actions));
            }
        }
    }

    /**
     * Helper to get the ontology client
     */
    getOntology() {
        if (!this.ontologyRid) throw new Error("Ontology RID missing");
        return this.client; // Assume client is the Ontology Client
    }

    /**
     * Helper to get Headers for Raw API
     */
    async getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Helper to get Object Info (API Name & RID)
     */
    getObjectInfo(key) {
        const info = this.ontologyObjects[key];
        if (!info || !info.apiName) {
            // Fallback for flat structure if needed, or error
            throw new Error(`Ontology Object '${key}' not configured properly.`);
        }
        return info;
    }

    /**
     * Reads flights from Ontology via OSDK or Raw API Fallback
     */
    async getAllFlights() {
        const { apiName, rid: objectTypeRid } = this.getObjectInfo('flights');
        try {
            console.log(`[SDK] Reading ${apiName} from Ontology...`);

            const ont = this.getOntology();
            if (ont && ont.objects && ont.objects[apiName]) {
                const allFlights = [];
                let nextPageToken = undefined;

                do {
                    const result = await ont.objects[apiName].fetchPage({
                        pageSize: 1000,
                        nextPageToken
                    });
                    allFlights.push(...result.data);
                    nextPageToken = result.nextPageToken;
                } while (nextPageToken);

                console.log(`[SDK] Fetched total ${allFlights.length} flights (OSDK).`);
                return allFlights;
            }

            console.warn("[SDK] OSDK .objects missing. Falling back to Raw API...");
            return await this.rawSearch(apiName);

        } catch (e) {
            console.warn("[SDK] Ontology Read Failed. Trying fallback to Dataset...", e);
            try {
                // Fallback to Raw Search first
                try {
                    return await this.rawSearch(apiName);
                } catch (rawErr) {
                    console.warn("[SDK] Raw Search failed. Trying Dataset Read...", rawErr);
                    // If Raw Search fails, try reading the Dataset directly
                    // This covers the case where Ontology Object Type is not created/synced yet
                    const flightData = await this.readDataset('flights');
                    // We need to map dataset columns to object properties if they differ?
                    // Currently mapFromRaw in schema.js handles mapping from sources.
                    // Dataset read returns raw rows, which usually match 'sources'.
                    return flightData;
                }
            } catch (e2) {
                console.error("[SDK] All Flight Read methods failed:", e2);
                throw e2;
            }
        }
    }

    async createObject(objectType, data) {
        const info = this.getObjectInfo(objectType);
        const { apiName, primaryKey, requiresPkOnCreate } = info;
        // Prefer config, fallback to default naming convention
        const actionName = info.actions?.create || this.generateDefaultActionName('create', apiName);

        try {
            console.log(`[SDK] Creating ${objectType} (API: ${apiName}) using Action: ${actionName}`);

            // Prepare parameters
            const createParams = { ...data };

            // Start with cleaning 'id' if it exists as a remnant of internal tracking, 
            // unless it is the actual primary key and is required.
            if (createParams.id && primaryKey !== 'id') {
                delete createParams.id;
            }

            // Check if we need to exclude the Primary Key (e.g. if Ontology generates it)
            // Default to keeping it if flag is undefined (backwards compatibility/safety)
            if (requiresPkOnCreate === false && primaryKey) {
                if (createParams[primaryKey]) {
                    console.log(`[SDK] Excluding PK '${primaryKey}' from Create Action (requiresPkOnCreate=false).`);
                    delete createParams[primaryKey];
                }
            }

            await this.applyAction(actionName, createParams);
            return;
        } catch (e) {
            console.error(`[SDK] Create Action '${actionName}' Failed:`, e);
            // Fallback to strict raw create?
            console.warn("[SDK] Fallback to Raw Create.");
            await this.rawCreate(apiName, data);
        }
    }

    async updateObject(objectType, id, data) {
        const info = this.getObjectInfo(objectType);
        const { apiName } = info;
        // Prefer config, fallback to default naming convention (Using 'edit' for update as requested)
        const actionName = info.actions?.update || this.generateDefaultActionName('edit', apiName);

        try {
            console.log(`[SDK] Updating ${objectType} (API: ${apiName}) using Action: ${actionName} on ${id}`);

            // Prepare parameters
            // 1. Inject Object Locator (The ApiName of the object is usually the parameter name for the object reference in "edit" actions)
            // e.g. "UscgFlights": "id-value"
            const params = { ...data };
            params[apiName] = id;

            // 2. Remove "id" if it is not a configured parameter (it's often just the PK)
            // We'll leave it if the action explicitely asks for the Object Reference (apiName),
            // but "id" caused a 400 error earlier.
            // Also remove the configured Primary Key from the parameters, as it is usually passed via the Object Locator (apiName)
            if (params.id) delete params.id;
            const { primaryKey } = info;
            if (primaryKey && params[primaryKey]) {
                console.log(`[SDK] Excluding PK '${primaryKey}' from Update Action parameters.`);
                delete params[primaryKey];
            }

            await this.applyAction(actionName, params);
            return;
        } catch (error) {
            // If Client Error (400 Bad Request, 409 Conflict), do NOT try raw fallback. It won't fix it.
            if (error.message.includes('400') || error.message.includes('409')) {
                throw error;
            }

            console.warn(`[SDK] Update Action '${actionName}' Failed: ${error.message}. Fallback to Raw Update...`);
            await this.rawUpdate(apiName, id, data);
        }
    }

    async deleteObject(objectType, id) {
        const info = this.getObjectInfo(objectType);
        const { apiName } = info;
        const actionName = info.actions?.delete || this.generateDefaultActionName('delete', apiName);

        try {
            console.log(`[SDK] Deleting ${objectType} (API: ${apiName}) using Action: ${actionName} on ${id}`);
            // Action expects parameter named after the Object Type (e.g. "UscgFlights")
            // sending { id } fails with "unknownParameterIds"
            await this.applyAction(actionName, { [apiName]: id });
            return;
        } catch (e) {
            console.error(`[SDK] Delete Action '${actionName}' Failed:`, e);
            console.warn("[SDK] Fallback to Raw Delete.");
            await this.rawDelete(apiName, id);
        }
    }

    /**
     * Generates default action name based on convention
     * e.g. UscgFlights -> create-uscg-flights
     */
    generateDefaultActionName(operation, objectApiName) {
        // Convert CamelCase/PascalCase to kebab-case
        const kebabName = objectApiName
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .toLowerCase();

        return `${operation}-${kebabName}`;
    }

    /**
     * V2 Action Apply Endpoint
     * POST /api/v2/ontologies/{ontologyRid}/actions/{actionApiName}/apply
     */
    async applyAction(actionApiName, parameters) {
        const url = `${this.getRawBaseUrl()}/api/v2/ontologies/${this.ontologyRid}/actions/${actionApiName}/apply`;
        console.log(`[Action] POST ${url}`, parameters);

        const resp = await fetch(url, {
            method: 'POST',
            headers: await this.getHeaders(),
            body: JSON.stringify({ parameters })
        });

        if (!resp.ok) {
            throw new Error(`Action Apply Failed: ${resp.status} ${await resp.text()}`);
        }

        const json = await resp.json();
        console.log("[Action] Success:", json);
        return json;
    }

    // --- Legacy / specific wrappers (can be removed if unused) ---






    /**
     * Get All Equipment (Pagination supported)
     */
    async getAllEquipment() {
        const { apiName } = this.getObjectInfo('equipment');
        try {
            console.log(`[SDK] Reading ${apiName} from Ontology...`);
            const ont = this.getOntology();

            if (ont && ont.objects && ont.objects[apiName]) {
                const allObjects = [];
                let nextPageToken = undefined;
                do {
                    const result = await ont.objects[apiName].fetchPage({
                        pageSize: 1000,
                        nextPageToken
                    });
                    allObjects.push(...result.data);
                    nextPageToken = result.nextPageToken;
                } while (nextPageToken);

                console.log(`[SDK] Fetched total ${allObjects.length} equipment items (OSDK).`);
                return allObjects;
            }

            console.warn("[SDK] OSDK .objects missing for equipment. Falling back to Raw API...");
            return await this.rawSearch(apiName);
        } catch (e) {
            console.error("[SDK] Equipment Ontology Read Failed:", e);
            console.warn("[SDK] Attempting Raw API Fallback...");
            try {
                return await this.rawSearch(apiName);
            } catch (e2) {
                console.warn("[SDK] Raw Fallback Failed, trying dataset read:", e2);
                return await this.readDataset('equipment');
            }
        }
    }

    /**
     * Get All Deployments (Pagination supported)
     */
    async getAllDeployments() {
        const { apiName } = this.getObjectInfo('deployments');
        try {
            console.log(`[SDK] Reading ${apiName} from Ontology...`);
            const ont = this.getOntology();

            if (ont && ont.objects && ont.objects[apiName]) {
                const allObjects = [];
                let nextPageToken = undefined;
                do {
                    const result = await ont.objects[apiName].fetchPage({
                        pageSize: 1000,
                        nextPageToken
                    });
                    allObjects.push(...result.data);
                    nextPageToken = result.nextPageToken;
                } while (nextPageToken);

                console.log(`[SDK] Fetched total ${allObjects.length} deployments (OSDK).`);
                return allObjects;
            }

            console.warn("[SDK] OSDK .objects missing for deployments. Falling back to Raw API...");
            return await this.rawSearch(apiName);
        } catch (e) {
            console.error("[SDK] Deployments Ontology Read Failed:", e);
            console.warn("[SDK] Attempting Raw API Fallback...");
            try {
                return await this.rawSearch(apiName);
            } catch (e2) {
                console.warn("[SDK] Raw Fallback Failed, trying dataset read:", e2);
                return await this.readDataset('deployments');
            }
        }
    }

    /**
     * Create Deployment
     */
    async createDeployment(data) {
        return this.createObject('deployments', data);
    }

    /**
     * Update Deployment
     */
    async updateDeployment(id, data) {
        return this.updateObject('deployments', id, data);
    }

    /**
     * Delete Deployment
     */
    async deleteDeployment(id) {
        return this.deleteObject('deployments', id);
    }

    // --- RAW API IMPLEMENTATION ---

    /**
     * Helper to get Headers for Raw API
     */
    async getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Helper to get Base URL for Raw API
     * Uses proxy in DEV to avoid CORS
     */
    getRawBaseUrl() {
        if (import.meta.env.DEV) {
            return "/foundry-api";
        }
        return this.baseUrl;
    }


    async executeAction(actionTypeRid, payload) {
        const url = `${this.getRawBaseUrl()}/action-service/v1/action-types/${actionTypeRid}/execute`;
        console.log(`[Action] POST ${url}`, payload);

        const resp = await fetch(url, {
            method: 'POST',
            headers: await this.getHeaders(),
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            throw new Error(`Action Execution Failed: ${resp.status} ${await resp.text()}`);
        }

        const json = await resp.json();
        console.log("[Action] Success:", json);
        return json;
    }

    async rawSearch(apiName) {
        const url = `${this.getRawBaseUrl()}/api/v2/ontologies/${this.ontologyRid}/objects/${apiName}/search`;
        console.log(`[Raw] POST ${url} (Iterative)`);

        let allObjects = [];
        let nextPageToken = null;

        do {
            const body = {
                pageSize: 1000,
                ...(nextPageToken && { nextPageToken })
            };

            const resp = await fetch(url, {
                method: 'POST',
                headers: await this.getHeaders(),
                body: JSON.stringify(body)
            });

            if (!resp.ok) throw new Error(`Raw Search Failed: ${resp.status} ${await resp.text()}`);

            const json = await resp.json();
            const data = json.data || [];
            if (data.length > 0) {
                // Map raw data (flatten properties)
                const mapped = data.map(obj => ({
                    $apiName: apiName,
                    $primaryKey: obj.__primaryKey,
                    ...obj,
                    ...(obj.properties || {})
                }));
                allObjects.push(...mapped);
            }

            nextPageToken = json.nextPageToken;

        } while (nextPageToken);

        console.log(`[SDK] Raw Search Fetched total ${allObjects.length} objects.`);
        return allObjects;
    }

    async rawCreate(apiName, properties) {
        const url = `${this.getRawBaseUrl()}/api/v2/ontologies/${this.ontologyRid}/objects/${apiName}`;
        console.log(`[Raw] POST ${url}`);
        const resp = await fetch(url, {
            method: 'POST',
            headers: await this.getHeaders(),
            body: JSON.stringify({ properties }) // properties wrapper? standard V2 object create
        });
        if (!resp.ok) throw new Error(`Raw Create Failed: ${resp.status} ${await resp.text()}`);
    }

    async rawUpdate(apiName, id, properties) {
        const url = `${this.getRawBaseUrl()}/api/v2/ontologies/${this.ontologyRid}/objects/${apiName}/${id}`;
        console.log(`[Raw] PATCH ${url}`);
        // Often update methods use Action or properties update
        // V2 Object Standard Update
        const resp = await fetch(url, {
            method: 'PATCH', // or PUT? PATCH is standard for partial
            headers: await this.getHeaders(),
            body: JSON.stringify({ properties })
        });
        if (!resp.ok) throw new Error(`Raw Update Failed: ${resp.status} ${await resp.text()}`);
    }

    async rawDelete(apiName, id) {
        const url = `${this.getRawBaseUrl()}/api/v2/ontologies/${this.ontologyRid}/objects/${apiName}/${id}`;
        console.log(`[Raw] DELETE ${url}`);
        const resp = await fetch(url, {
            method: 'DELETE',
            headers: await this.getHeaders()
        });
        if (!resp.ok) throw new Error(`Raw Delete Failed: ${resp.status} ${await resp.text()}`);
    }

    /**
     * Test verifying Ontology Access
     */
    async verifyOntologyAccess() {
        try {
            await this.getAllFlights();
            return true;
        } catch (e) {
            console.error("Verify failed", e);
            return false;
        }
    }

    // Keep Dataset methods as fallback/hybrid for now as they are reliable for backing store
    getRid(name) {
        return this.datasets[name];
    }

    /**
     * Read all rows from a dataset
     */
    async readDataset(datasetName) {
        const rid = this.getRid(datasetName);
        if (!rid) return [];
        try {
            const branch = config.foundry?.defaultBranch || 'master';
            // console.log(`[SDK] Reading dataset ${datasetName} (${rid}) on branch '${branch}'...`);

            // Try fetching as JSON without branch (User request to fix 404s)
            const url = `${this.getRawBaseUrl()}/api/v1/datasets/${rid}/read?format=json&branch=${branch}`;
            const resp = await fetch(url, {
                method: 'GET',
                headers: await this.getHeaders()
            });

            if (!resp.ok) {
                if (resp.status === 404 || resp.status === 400) {
                    console.warn(`[SDK] Dataset '${datasetName}' not found or branch missing (404/400). Skipping.`);
                    return [];
                }

                console.warn(`[SDK] JSON Read failed: ${resp.status}. Trying POST /read (legacy)...`);
                // Retry with POST if GET fails? Or just try Preview
                // Fallback to Preview
                const previewUrl = `${this.getRawBaseUrl()}/api/v1/datasets/${rid}/preview?format=json&branch=${branch}`;
                const prevResp = await fetch(previewUrl, { method: 'GET', headers: await this.getHeaders() });

                if (!prevResp.ok) {
                    if (prevResp.status === 404 || prevResp.status === 400) {
                        console.warn(`[SDK] Dataset '${datasetName}' Preview not found (404/400). Skipping.`);
                        return [];
                    }
                    throw new Error(`Dataset Read/Preview Failed: ${resp.status} / ${prevResp.status}`);
                }

                const rows = await prevResp.json();
                const data = Array.isArray(rows) ? rows : (rows.data || []);
                return data;
            }

            const rows = await resp.json();
            const data = Array.isArray(rows) ? rows : (rows.data || []);
            // console.log(`[SDK] Read ${data.length} rows from ${datasetName}.`);
            return data;

        } catch (e) {
            console.error(`[SDK] Read Failed for ${datasetName}:`, e);
            return [];
        }
    }

    async writeDataset(datasetName, data) {
        console.warn("[SDK] OSDK Client does not support .datasets.writeTable.");
        return false;
    }

    async appendRecord(datasetName, record) {
        console.warn("[SDK] OSDK Client does not support .datasets.appendTable.");
        return false;
    }

    /**
     * Update a record using Read-Modify-Write pattern
     * @param {string} datasetName 
     * @param {string} idField - Field name to match unique ID (e.g. 'id')
     * @param {string|number} idValue - Value to match
     * @param {Object} updates - Object containing fields to update
     */
    async updateRecord(datasetName, idField, idValue, updates) {
        console.warn("[SDK] OSDK Client does not support updateRecord for Datasets.");
        return false;
    }
}

export const foundrySDKService = new FoundrySDKService();
