import { config } from '../config';

/**
 * Service to interact with Foundry Datasets via API
 */
class FoundryService {
    constructor() {
        // In development, use the local proxy to avoid CORS. In production (Electron/Deployed), use full URL.
        const isDev = import.meta.env.DEV;
        this.baseUrl = isDev ? '/foundry-api' : config.foundry?.url;
        this.token = config.foundry?.token;
        this.datasets = config.foundry?.datasets || {};
        this.defaultBranch = config.foundry?.defaultBranch || 'master';
    }

    _getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Helper: Fetch with retry logic
     */
    async _fetchWithRetry(url, options = {}, retries = 3) {
        try {
            const response = await fetch(url, {
                ...options,
                cache: 'no-store' // Prevent browser caching
            });

            if (response.status === 429 && retries > 0) {
                const retryAfter = response.headers.get('Retry-After') || 1;
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return this._fetchWithRetry(url, options, retries - 1);
            }
            return response;
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this._fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    }

    /**
     * Get Dataset RID by name
     * @param {string} name 
     */
    getRid(name) {
        return this.datasets[name];
    }

    /**
     * Read dataset as CSV and parse to JSON
     * Uses the /read endpoint (or assumes we can get CSV/JSON)
     * For simplification, we'll try to fetch CSV and convert or JSON if supported.
     * The python backend used: /api/v1/datasets/{rid}/read?format=csv
     */
    async readDataset(datasetName) {
        const rid = this.getRid(datasetName);
        if (!rid) {
            console.error(`Dataset ${datasetName} not configured.`);
            return [];
        }

        console.log(`[FoundryService] Reading ${datasetName} (${rid}) from branch: ${this.defaultBranch}`);

        // Direct read (api/v1/datasets/rid/read) requires a schema to be applied.
        // Since we can't programmatically apply schemas, and users might not have done it,
        // we default to listing files and downloading the raw CSV directly.
        // This avoids 404 errors in the console.
        try {
            return await this._readViaFileListing(rid);
        } catch (error) {
            console.error(`Error reading ${datasetName}:`, error);
            return [];
        }
    }

    /**
     * Fallback: List files and download ALL CSVs and merge them
     */
    async _readViaFileListing(rid) {
        try {
            const branch = this.defaultBranch;
            const listUrl = `${this.baseUrl}/api/v1/datasets/${rid}/files?branch=${encodeURIComponent(branch)}`;
            console.log(`[FoundryService] Fetching files list from: ${listUrl}`);

            const listResp = await this._fetchWithRetry(listUrl, { headers: this._getHeaders() });

            if (!listResp.ok) return [];

            const listData = await listResp.json();
            const allFiles = listData.data || [];

            // Filter for CSVs
            const csvFiles = allFiles.filter(f => f.path.endsWith('.csv'));

            console.log(`[FoundryService] Found ${csvFiles.length} CSV files:`, csvFiles.map(f => f.path));

            if (csvFiles.length === 0) return [];

            let fullData = [];

            // Download and parse checks for each file
            // Use Promise.all for parallelism
            await Promise.all(csvFiles.map(async (file) => {
                try {
                    console.log(`[FoundryService] Downloading: ${file.path}`);
                    const contentUrl = `${this.baseUrl}/api/v1/datasets/${rid}/files/${encodeURIComponent(file.path)}/content?branch=${encodeURIComponent(branch)}`;
                    const contentResp = await this._fetchWithRetry(contentUrl, { headers: this._getHeaders() });

                    if (contentResp.ok) {
                        const csvText = await contentResp.text();
                        const jsonData = this._csvToJson(csvText);
                        fullData = [...fullData, ...jsonData];
                    }
                } catch (err) {
                    console.error(`Failed to read file ${file.path}:`, err);
                }
            }));

            return fullData;
        } catch (e) {
            console.error("Fallback read failed:", e);
            return [];
        }
    }

    /**
     * Write full dataset (SNAPSHOT)
     * @param {string} datasetName 
     * @param {Array} data JSON array of objects
     */
    async writeDataset(datasetName, data) {
        const rid = this.getRid(datasetName);
        if (!rid) return false;

        let txId = null;

        try {
            // 1. Start Transaction (V2)
            // Use configured default branch
            const branchName = this.defaultBranch;

            // Explicitly ensure branch exists (like Python backend)
            await this._ensureBranch(datasetName, branchName);

            const txUrl = `${this.baseUrl}/api/v2/datasets/${rid}/transactions?branchName=${encodeURIComponent(branchName)}`;

            console.log(`Starting transaction on branch: ${branchName}`);

            let txResp = await fetch(txUrl, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify({
                    transactionType: 'SNAPSHOT'
                })
            });

            // Handle 409 Conflict (Transaction already open)
            if (txResp.status === 409) {
                console.warn(`409 Conflict for ${datasetName}. Attempting to abort open transactions and retry...`);
                await this._abortOpenTransactions(rid); // Warning: make sure this aborts on correct branch if needed
                // Retry once
                txResp = await fetch(txUrl, {
                    method: 'POST',
                    headers: this._getHeaders(),
                    body: JSON.stringify({ transactionType: 'SNAPSHOT' })
                });
            }

            if (!txResp.ok) throw new Error(`Failed to start transaction: ${txResp.status}`);
            const txData = await txResp.json();
            txId = txData.rid;
            console.log(`Transaction started: ${txId}`);

            // 2. Upload File (V2)
            // Endpoint: POST /api/v2/datasets/{datasetRid}/files/{filePath}/upload?transactionRid={txId}
            const csvContent = this._jsonToCsv(data);
            const fileName = `upload_${datasetName}.csv`;
            const uploadUrl = `${this.baseUrl}/api/v2/datasets/${rid}/files/${encodeURIComponent(fileName)}/upload?transactionRid=${txId}`;

            const uploadHeaders = {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/octet-stream' // Binary/Raw
            };

            const uploadResp = await fetch(uploadUrl, {
                method: 'POST',
                headers: uploadHeaders,
                body: csvContent // Send string directly
            });

            if (!uploadResp.ok) throw new Error(`Failed to upload file: ${uploadResp.status}`);

            // 3. Commit Transaction (V1)
            // Works with V2 transactions
            const commitUrl = `${this.baseUrl}/api/v1/datasets/${rid}/transactions/${txId}/commit`;
            const commitResp = await fetch(commitUrl, {
                method: 'POST',
                headers: this._getHeaders()
            });

            if (!commitResp.ok) throw new Error("Failed to commit transaction");

            console.log(`[FoundryService] Successfully wrote ${datasetName} to ${rid} on branch ${branchName}`);

            // --- Instant Sync: Auto-Merge to master ---
            if (branchName === 'spark-app') {
                try {
                    console.log(`[FoundryService] Attempting Instant Sync: spark-app -> master (Tx: ${txId})`);
                    await this.updateBranch(datasetName, 'master', txId);
                    console.log(`[FoundryService] Instant Sync successful.`);
                } catch (mergeError) {
                    console.warn(`[FoundryService] Instant Sync failed:`, mergeError);
                    // Non-fatal, user can manually merge if needed
                }
            }

            return true;
        } catch (error) {
            console.error(`Error writing ${datasetName}:`, error);
            // Abort transaction on failure to prevent locking
            if (txId) await this._abortTransaction(rid, txId);
            return false;
        }
    }

    /**
     * Manually update a branch to point to a specific transaction (Fast-Forward Merge)
     * @param {string} datasetName 
     * @param {string} branchName 
     * @param {string} transactionRid 
     */
    async updateBranch(datasetName, branchName, transactionRid) {
        const rid = this.getRid(datasetName);
        if (!rid) return false;

        const url = `${this.baseUrl}/api/v1/datasets/${rid}/branches/${encodeURIComponent(branchName)}`;
        const resp = await fetch(url, {
            method: 'POST', // V1 Update Branch
            headers: this._getHeaders(),
            body: JSON.stringify({ transactionRid })
        });

        if (!resp.ok) {
            throw new Error(`Failed to update branch ${branchName} to ${transactionRid}: ${resp.status}`);
        }
        return true;
    }
    async _abortTransaction(rid, txId) {
        try {
            const url = `${this.baseUrl}/api/v1/datasets/${rid}/transactions/${txId}/abort`;
            await fetch(url, { method: 'POST', headers: this._getHeaders() });
            console.log(`Aborted transaction ${txId} for ${rid}`);
        } catch (e) {
            console.warn("Failed to abort transaction", e);
        }
    }

    async _ensureBranch(datasetName, branch) {
        if (!branch || branch === 'master') return true;
        const rid = this.getRid(datasetName);

        try {
            // First check if branch exists to avoid noisy 409 errors
            const listUrl = `${this.baseUrl}/api/v1/datasets/${rid}/branches`;
            const listResp = await fetch(listUrl, {
                method: 'GET',
                headers: this._getHeaders()
            });

            if (listResp.ok) {
                const branches = await listResp.json();
                const branchList = branches.values || branches.data || [];
                const exists = branchList.some(b => b.id === branch || b.branchId === branch);

                if (exists) {
                    return true; // Branch already exists, no need to create
                }
            }

            // Branch doesn't exist, create it
            console.log(`Creating branch '${branch}' for ${datasetName}...`);
            const url = `${this.baseUrl}/api/v1/datasets/${rid}/branches`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify({ branchId: branch })
            });

            if (resp.ok || resp.status === 409) {
                // 200/201 created, 409 exists
                return true;
            }
            console.warn(`Failed to create branch: ${resp.status}`);
            return false;
        } catch (e) {
            console.error("Error creating branch:", e);
            return false;
        }
    }

    async _abortOpenTransactions(rid, branch) {
        try {
            // Try listing all transactions and filtering client-side
            // Fix: Use branch specific endpoint if possible, or global
            let url = `${this.baseUrl}/api/v1/datasets/${rid}/transactions`;
            if (branch) {
                url = `${this.baseUrl}/api/v1/datasets/${rid}/branches/${encodeURIComponent(branch)}/transactions`;
            }

            const resp = await fetch(url, { headers: this._getHeaders() });

            if (!resp.ok) {
                console.warn(`Failed to list transactions: ${resp.status}`);
                return;
            }

            const data = await resp.json();
            const allTxs = data.values || data.data || [];

            // Filter for OPEN transactions
            const openTxs = allTxs.filter(tx => tx.status === 'OPEN');

            console.log(`Found ${openTxs.length} OPEN transactions for ${rid} on branch ${branch}. Aborting...`);

            for (const tx of openTxs) {
                await this._abortTransaction(rid, tx.rid);
            }
        } catch (e) {
            console.warn("Failed to cleanup open transactions", e);
        }
    }

    /**
     * Helper: Read -> Append -> Write
     */
    /**
     * Efficiently append a single record to a dataset using APPEND transaction
     * This avoids reading/writing the full dataset
     */
    async appendRecord(datasetName, record) {
        console.warn(`[FoundryService] Native APPEND disabled due to corruption risk. Falling back to SNAPSHOT write for ${datasetName}.`);
        return this.writeRecord(datasetName, record);
    }

    /**
     * Write/update a single record (legacy method - uses full dataset read/write)
     * Consider using appendRecord for new records
     */
    async writeRecord(datasetName, record) {
        const currentData = await this.readDataset(datasetName);
        currentData.push(record);
        return await this.writeDataset(datasetName, currentData);
    }

    /**
     * Helper: Read -> Update -> Write
     * @param {string} datasetName 
     * @param {string} idField Field to identify record
     * @param {string|number} idValue Value to match
     * @param {Object} updates Updates to apply
     */
    async updateRecord(datasetName, idField, idValue, updates) {
        const currentData = await this.readDataset(datasetName);
        const index = currentData.findIndex(item => String(item[idField]) === String(idValue));

        if (index !== -1) {
            currentData[index] = { ...currentData[index], ...updates };
            return await this.writeDataset(datasetName, currentData);
        }
        return false;
    }

    // --- CSV Helpers ---

    _csvToJson(csv) {
        const lines = csv.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) return [];

        // Robust CSV Line Parser
        const parseLine = (text) => {
            const results = [];
            let entry = [];
            let inQuote = false;

            for (let i = 0; i < text.length; i++) {
                const char = text[i];

                if (char === '"') {
                    inQuote = !inQuote;
                    // Keep quotes? Removing them here simplifies processing but might break escaped double quotes ""
                    // For now, let's keep them and clean up after split
                }

                if (char === ',' && !inQuote) {
                    results.push(entry.join(''));
                    entry = [];
                } else {
                    entry.push(char);
                }
            }
            results.push(entry.join('')); // Push last value
            return results;
        };

        const headers = parseLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

        return lines.slice(1).map(line => {
            const values = parseLine(line);

            const obj = {};
            headers.forEach((header, i) => {
                let val = values[i] !== undefined ? values[i] : '';
                val = val.trim();

                // Handle quotes: Remove surrounding strings and unescape "" -> "
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.slice(1, -1).replace(/""/g, '"');
                }

                // Handle boolean strings/numbers or keep as string
                // Keeping as string largely safely
                obj[header] = val;
            });
            return obj;
        });
    }

    _jsonToCsv(jsonArray) {
        if (!jsonArray || jsonArray.length === 0) return "";
        const headers = Object.keys(jsonArray[0]);
        const headerLine = headers.join(',');

        const lines = jsonArray.map(obj => {
            return headers.map(h => {
                let val = obj[h] === undefined || obj[h] === null ? '' : String(obj[h]);
                // Escape quotes
                if (val.includes(',') || val.includes('"')) {
                    val = `"${val.replace(/"/g, '""')}"`;
                }
                return val;
            }).join(',');
        });

        return [headerLine, ...lines].join('\n');
    }
    /**
     * Search Objects (V2 API)
     * @param {string} objectTypeId API Name of the object
     * @param {Object} query Search query (default matchAll)
     */
    async searchObjects(objectTypeId, query = { type: 'matchAll' }) {
        // Get Ontology RID from config
        // Config is imported at top
        const ontologyRid = config.ONTOLOGY?.RID;

        if (!ontologyRid) {
            console.warn("[FoundryService] Ontology RID not configured. Cannot search objects.");
            return [];
        }

        const url = `${this.baseUrl}/api/v2/ontologies/${ontologyRid}/objects/${objectTypeId}/search`;

        try {
            console.log(`[FoundryService] Searching objects ${objectTypeId} in ontology ${ontologyRid}`);
            // Payload structure: verify if 'query' or 'where' is expected
            // 'query' -> 400 UnknownField
            // 'where' -> 500 Internal Error
            // Attempt 3: The body IS the query object directly.
            const payload = {
                type: 'matchAll'
            };

            console.log(`[FoundryService] Searching objects ${objectTypeId} w/ payload:`, JSON.stringify(payload));

            const resp = await this._fetchWithRetry(url, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                const errText = await resp.text();
                console.error(`[FoundryService] Object search failed: ${resp.status} - ${errText}`);
                throw new Error(`Foundry Object Search Error: ${resp.status} - ${errText}`);
            }

            const data = await resp.json();
            // Simplify result structure (flatten properties)
            return (data.data || []).map(obj => ({
                ...obj.properties, // Flatten properties to top level
                __rid: obj.rid,
                __primaryKey: obj.primaryKey
            }));

        } catch (e) {
            console.error("Error searching objects:", e);
            return [];
        }
    }

    /**
     * Load all objects of a type using Object Set API (V2)
     * This is often more reliable than search for "Get All"
     */
    async loadObjects(objectTypeId) {
        const ontologyRid = config.ONTOLOGY?.RID;
        if (!ontologyRid) {
            console.warn("[FoundryService] Ontology RID not configured.");
            return [];
        }

        const url = `${this.baseUrl}/api/v2/ontologies/${ontologyRid}/objectSets/loadObjects`;

        try {
            console.log(`[FoundryService] Loading objects ${objectTypeId} via ObjectSet API`);
            const body = {
                objectSet: {
                    type: "base",
                    objectType: objectTypeId
                }
            };

            const resp = await this._fetchWithRetry(url, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify(body)
            });

            if (!resp.ok) {
                const errText = await resp.text();
                console.error(`[FoundryService] Load objects failed: ${resp.status} - ${errText}`);
                throw new Error(`Foundry Load Objects Error: ${resp.status} - ${errText}`);
            }

            const data = await resp.json();
            console.log("[FoundryService] Raw LoadObjects Response:", JSON.stringify(data)); // DEBUG
            // Response format seems to be flat objects already based on logs
            return (data.data || []).map(obj => ({
                ...obj, // The properties are at the root
                // Ensure helper keys exist if they aren't already there (logs show they are, but safety first)
                __rid: obj.rid || obj.__rid,
                __primaryKey: obj.primaryKey || obj.__primaryKey
            }));
        } catch (e) {
            console.error("Error loading objects:", e);
            throw e;
        }
    }

    /**
     * Apply an Action (V2)
     * @param {string} actionType API Name of the action (e.g., 'create-flight')
     * @param {Object} parameters Key-value pairs of parameters
     */
    async applyAction(actionType, parameters = {}) {
        const ontologyRid = config.ONTOLOGY?.RID;
        if (!ontologyRid) {
            throw new Error("Ontology RID not configured.");
        }

        const url = `${this.baseUrl}/api/v2/ontologies/${ontologyRid}/actions/${actionType}/apply`;

        console.log(`[FoundryService] Applying Action: ${actionType}`, parameters);

        try {
            const resp = await this._fetchWithRetry(url, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify({
                    parameters: parameters
                })
            });

            if (!resp.ok) {
                const errText = await resp.text();
                console.error(`[FoundryService] Action failed: ${resp.status} - ${errText}`);
                throw new Error(`Action Error: ${resp.status} - ${errText}`);
            }

            return await resp.json();
        } catch (e) {
            console.error("Error applying action:", e);
            throw e;
        }
    }
}

export const foundryService = new FoundryService();

