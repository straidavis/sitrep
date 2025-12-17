const fs = require('fs');
const path = require('path');

// Try to load local config (for standalone EXE usage)
// Search priority: 1. Next to EXE, 2. Root dir via ../client (dev)
const exeDir = path.dirname(process.execPath);
const configPaths = [
    path.join(exeDir, 'sitrep-config.json'),
    path.join(__dirname, '../client/sitrep-config.json'),
    path.join(__dirname, 'sitrep-config.json')
];

let addedConfig = false;
for (const cfgPath of configPaths) {
    if (fs.existsSync(cfgPath)) {
        try {
            console.log(`Loading config from ${cfgPath}`);
            const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
            // Map Config to Env Vars if not set
            // Example: Force local sqlite if running standalone
            if (!process.env.PORT && cfg.serverPort) process.env.PORT = cfg.serverPort;

            // Allow DB override from config
            if (cfg.serverDbPath) process.env.DB_PATH = cfg.serverDbPath;
            if (cfg.serverDbHead) process.env.DB_HOST = cfg.serverDbHost;

            addedConfig = true;
            break;
        } catch (e) {
            console.error("Error reading config", e);
        }
    }
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const Flight = require('./models/Flight');
const Equipment = require('./models/Equipment');
const Deployment = require('./models/Deployment');
const ApiKey = require('./models/ApiKey');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => res.sendStatus(200));

// Auth Middleware
const authenticateApiKey = async (req, res, next) => {
    const key = req.header('X-API-Key');
    if (!key) return res.status(401).json({ error: 'API Key missing' });

    try {
        const apiKey = await ApiKey.findOne({ where: { key, status: 'Active' } });
        if (!apiKey) {
            return res.status(403).json({ error: 'Invalid or revoked API Key' });
        }
        next();
    } catch (error) {
        console.error('Auth Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Routes

// GET /flights
app.get('/v1/flights', authenticateApiKey, async (req, res) => {
    try {
        const { startDate, endDate, deploymentId } = req.query;
        const where = {};

        if (startDate && endDate) {
            where.date = {
                [require('sequelize').Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }
        if (deploymentId) {
            where.deploymentId = deploymentId;
        }

        const flights = await Flight.findAll({ where });
        res.json(flights);
    } catch (error) {
        console.error('Error fetching flights:', error);
        res.status(500).json({ error: 'Failed to fetch flights' });
    }
});

// POST /flights
app.post('/v1/flights', authenticateApiKey, async (req, res) => {
    try {
        const flight = await Flight.create(req.body);
        res.status(201).json(flight);
    } catch (error) {
        console.error('Error creating flight:', error);
        res.status(500).json({ error: 'Failed to create flight' });
    }
});

// GET /equipment
app.get('/v1/equipment', authenticateApiKey, async (req, res) => {
    try {
        const equipment = await Equipment.findAll();
        res.json(equipment);
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ error: 'Failed to fetch equipment' });
    }
});

const InventoryItem = require('./models/InventoryItem');
const Kit = require('./models/Kit');
const KitItem = require('./models/KitItem');

// ... (existing imports match top file)

// GET /inventory
app.get('/v1/inventory', authenticateApiKey, async (req, res) => {
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

// POST /inventory (Bulk Upsert/Sync)
app.post('/v1/inventory', authenticateApiKey, async (req, res) => {
    try {
        const items = Array.isArray(req.body) ? req.body : [req.body];
        // Basic implementation: Create or Update based on ID?
        // SQLite/Sequelize 'bulkCreate' with updateOnDuplicate
        const result = await InventoryItem.bulkCreate(items, {
            updateOnDuplicate: ['partNumber', 'description', 'quantity', 'category', 'location', 'updatedAt']
        });
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Sync failed' });
    }
});

// GET /kits
app.get('/v1/kits', authenticateApiKey, async (req, res) => {
    try {
        const { deploymentId } = req.query;
        const where = {};
        if (deploymentId) where.deploymentId = deploymentId;

        const kits = await Kit.findAll({ where });
        res.json(kits);
    } catch (error) {
        res.status(500).json({ error: 'Fetch failed' });
    }
});

// GET /kit-items
app.get('/v1/kit-items', authenticateApiKey, async (req, res) => {
    try {
        const items = await KitItem.findAll();
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Fetch failed' });
    }
});

// Admin Route to Create Keys
app.post('/v1/admin/keys', async (req, res) => {
    try {
        const { name, key } = req.body;
        const newKey = await ApiKey.create({ name, key });
        res.status(201).json(newKey);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize DB and Start Server
sequelize.sync().then(() => {
    console.log('Database synced');
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to sync database:', err);
});
