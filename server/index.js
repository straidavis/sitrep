const fs = require('fs');
const path = require('path');

// --- LOGGING SETUP ---
const logFile = path.join(__dirname, 'server_debug.log');
const log = (msg) => {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, entry);
    console.log(msg);
};

log("Server Starting...");

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
            log(`Loading config from ${cfgPath}`);
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
            log(`Error reading config: ${e.message}`);
        }
    }
}

// LOAD ENV from foundry_client if available
const clientEnv = path.join(__dirname, '../foundry_client/.env');
if (fs.existsSync(clientEnv)) {
    log(`Loading .env from ${clientEnv}`);
    require('dotenv').config({ path: clientEnv });
} else {
    log("Loading standard .env");
    require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const Flight = require('./models/Flight');
const Equipment = require('./models/Equipment');
const Deployment = require('./models/Deployment');


const app = express();
const PORT = process.env.PORT || 3001;

// DEBUG: Log Auth Config Status
log("--- Auth Config Check ---");
log(`CLIENT_ID: ${process.env.VITE_AZURE_CLIENT_ID ? "[SET]" : "[MISSING]"}`);
log(`TENANT_ID: ${process.env.VITE_AZURE_TENANT_ID ? "[SET]" : "[MISSING]"}`);
log(`CLIENT_SECRET: ${process.env.VITE_AZURE_CLIENT_SECRET ? "[SET]" : "[MISSING]"}`);
log("-------------------------");

// Middleware
app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => res.sendStatus(200));

// --- Auth Dependencies & Config ---
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const OIDCStrategy = require('passport-azure-ad').OIDCStrategy;

// Mock Easy Auth Config using Env Vars (User must provide these)
if (process.env.VITE_AZURE_CLIENT_ID && process.env.VITE_AZURE_CLIENT_SECRET) {
    log("Enabling OIDC Auth Emulation (Manual Redirect Mode)");

    // Session Config
    app.use(cookieParser());
    app.use(session({
        secret: 'super_secret_local_dev_key',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));

    // 1. Manual Login Redirect (Bypasses Passport Strategy validation)
    app.get('/.auth/login/aad', (req, res) => {
        const tenant = process.env.VITE_AZURE_TENANT_ID || 'common';
        const clientId = process.env.VITE_AZURE_CLIENT_ID;
        const redirectUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?` +
            `client_id=${clientId}` +
            `&response_type=id_token` +
            `&redirect_uri=http://localhost:3000` +
            `&response_mode=fragment` +
            `&scope=openid profile email` +
            `&state=12345` +
            `&nonce=${Math.random().toString(36).substring(7)}`;

        res.redirect(redirectUrl);
    });

    // 2. Callback Endpoint (Legacy/Unused for fragment mode but kept for safety)
    app.post('/.auth/login/aad/callback', (req, res) => {
        res.status(200).json({ status: "Callback ignored. Frontend handles fragment." });
    });

    // Manual Login Endpoint (Frontend sends id_token/code)
    app.post('/.auth/manual-login', async (req, res) => {
        const { user } = req.body;
        if (user) {
            // Mock session creation
            req.login(user, (err) => {
                if (err) return res.status(500).json({ error: err });
                return res.json({ success: true, user });
            });
        } else {
            res.status(400).json({ error: "No user provided" });
        }
    });

    // 3. Me Endpoint (Mimic App Service)
    app.get('/.auth/me', (req, res) => {
        if (req.isAuthenticated()) {
            // Emulate App Service Payload
            const payload = [{
                user_id: req.user._json.email || req.user._json.preferred_username || req.user.oid,
                user_claims: Object.entries(req.user._json).map(([typ, val]) => ({ typ, val })),
                provider_name: "aad"
            }];
            res.json(payload);
        } else {
            res.status(401).json(null);
        }
    });

    // 4. Logout
    app.get('/.auth/logout', (req, res) => {
        req.logout(() => {
            res.redirect('/');
        });
    });

} else {
    console.warn("Missing VITE_AZURE_CLIENT_ID or CLIENT_SECRET. Auth Emulation Routes skipped.");
    // Fallback route to explain why it failed
    app.use('/.auth/*', (req, res) => {
        res.status(500).json({
            error: "Auth Routes not enabled on server.",
            details: "Missing VITE_AZURE_CLIENT_ID or VITE_AZURE_CLIENT_SECRET in server environment.",
            checkLogs: "See server console for '[MISSING]' config logs."
        });
    });
}

// Routes

// GET /flights
app.get('/v1/flights', async (req, res) => {
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
app.post('/v1/flights', async (req, res) => {
    try {
        const flight = await Flight.create(req.body);
        res.status(201).json(flight);
    } catch (error) {
        console.error('Error creating flight:', error);
        res.status(500).json({ error: 'Failed to create flight' });
    }
});

// GET /equipment
app.get('/v1/equipment', async (req, res) => {
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
app.get('/v1/inventory', async (req, res) => {
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
app.post('/v1/inventory', async (req, res) => {
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
app.get('/v1/kits', async (req, res) => {
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
app.get('/v1/kit-items', async (req, res) => {
    try {
        const items = await KitItem.findAll();
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Fetch failed' });
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
