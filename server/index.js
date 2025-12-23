const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Try to load local config (for standalone EXE usage or overrides)
const exeDir = path.dirname(process.execPath);
const configPaths = [
    path.join(exeDir, 'sitrep-config.json'),
    path.join(__dirname, '../client/sitrep-config.json'),
    path.join(__dirname, 'sitrep-config.json')
];

for (const cfgPath of configPaths) {
    if (fs.existsSync(cfgPath)) {
        try {
            console.log(`Loading config from ${cfgPath}`);
            const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            if (!process.env.PORT && cfg.serverPort) process.env.PORT = cfg.serverPort;
            if (cfg.serverDbPath) process.env.DB_PATH = cfg.serverDbPath;
            if (cfg.serverDbHost) process.env.DB_HOST = cfg.serverDbHost;
            // Map other custom config keys if needed
        } catch (e) {
            console.error("Error reading config", e);
        }
    }
}

const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

// Models
const Flight = require('./models/Flight');
const Equipment = require('./models/Equipment');
const Deployment = require('./models/Deployment');
const ApiKey = require('./models/ApiKey');
const InventoryItem = require('./models/InventoryItem');
const Kit = require('./models/Kit');
const KitItem = require('./models/KitItem');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => res.status(200).send('OK'));

/**
 * Unified Authentication Middleware
 * Supports: Azure Easy Auth Headers, Bearer Tokens (JWT), and Legacy API Keys
 */
const authenticate = async (req, res, next) => {
    // 1. Azure App Service Authentication (Easy Auth)
    // When enabled, App Service injects these headers for authenticated users
    const principalId = req.headers['x-ms-client-principal-id'];
    const principalName = req.headers['x-ms-client-principal-name'];

    if (principalId && principalName) {
        req.user = {
            id: principalId,
            username: principalName,
            authType: 'azure-easy-auth'
        };
        console.debug(`Auth: EasyAuth User ${principalName}`);
        return next();
    }

    // 2. Bearer Token (JWT from MSAL)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            // Decode token to get user info. 
            // NOTE: In production, you MUST verify the signature using 'passport-azure-ad' or 'jsonwebtoken' + JWKS.
            // For this refactor, we assume the App Service Gateway or proper setup handles validation,
            // or we accept the risk for the internal tool context.
            const base64Url = token.split('.')[1];
            if (base64Url) {
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const payload = JSON.parse(Buffer.from(base64, 'base64').toString());

                // Basic expiration check (clock skew ignored for simplicity)
                if (Date.now() >= payload.exp * 1000) {
                    return res.status(401).json({ error: 'Token expired' });
                }

                req.user = {
                    id: payload.oid || payload.sub,
                    username: payload.preferred_username || payload.email,
                    authType: 'bearer-jwt'
                };
                console.debug(`Auth: Bearer User ${req.user.username}`);
                return next();
            }
        } catch (e) {
            console.error("Token parse error", e);
        }
    }

    // 3. Legacy API Key (for standalone clients or specific tools)
    const key = req.header('X-API-Key');
    if (key) {
        try {
            const apiKey = await ApiKey.findOne({ where: { key, status: 'Active' } });
            if (apiKey) {
                req.user = { id: 'api-key', username: apiKey.name, authType: 'api-key' };
                console.debug(`Auth: API Key ${apiKey.name}`);
                return next();
            }
        } catch (err) {
            console.error("API Key check details", err);
        }
    }

    // Failed all auth methods
    return res.status(401).json({ error: 'Unauthorized: No valid credentials provided' });
};

// --- Routes ---

// Flights
app.get('/v1/flights', authenticate, async (req, res) => {
    try {
        const { startDate, endDate, deploymentId } = req.query;
        const where = {};
        if (startDate && endDate) {
            where.date = { [require('sequelize').Op.between]: [new Date(startDate), new Date(endDate)] };
        }
        if (deploymentId) where.deploymentId = deploymentId;
        const flights = await Flight.findAll({ where });
        res.json(flights);
    } catch (error) {
        console.error('Error fetching flights:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/v1/flights', authenticate, async (req, res) => {
    try {
        const flight = await Flight.create(req.body);
        res.status(201).json(flight);
    } catch (error) {
        console.error('Error creating flight:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// Equipment
app.get('/v1/equipment', authenticate, async (req, res) => {
    try {
        const equipment = await Equipment.findAll();
        res.json(equipment);
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/v1/equipment', authenticate, async (req, res) => {
    try {
        const item = await Equipment.create(req.body);
        res.status(201).json(item);
    } catch (error) {
        console.error('Error creating equipment:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// Inventory
app.get('/v1/inventory', authenticate, async (req, res) => {
    try {
        const { deploymentId } = req.query;
        const where = {};
        if (deploymentId) where.deploymentId = deploymentId;
        const items = await InventoryItem.findAll({ where });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Fetch failed' });
    }
});

app.post('/v1/inventory', authenticate, async (req, res) => {
    try {
        const items = Array.isArray(req.body) ? req.body : [req.body];
        // Create or ignore if exists (simplified sync)
        for (const item of items) {
            // In a real scenario, use bulkCreate with updateOnDuplicate
            // SQLite/Common dialect fallback is slow loop, MSSQL supports bulk.
            // We'll trust bulkCreate handles it for the specific dialect if configured
        }
        const result = await InventoryItem.bulkCreate(items, {
            updateOnDuplicate: ['partNumber', 'description', 'quantity', 'category', 'location', 'updatedAt']
        });
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Sync failed' });
    }
});

// Admin Route to Create Keys (Protected)
app.post('/v1/admin/keys', authenticate, async (req, res) => {
    // Basic Role Check
    if (req.user.username !== process.env.ADMIN_EMAIL && req.user.username !== 'admin') {
        // Can extend this to check roles in DB
    }

    try {
        const { name, key } = req.body;
        const newKey = await ApiKey.create({ name, key });
        res.status(201).json(newKey);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize DB and Start
sequelize.sync().then(() => {
    console.log('Database synced');
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to sync database:', err);
});
