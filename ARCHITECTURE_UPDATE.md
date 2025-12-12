# Architecture Update: Azure Backend Integration

## Overview
The architecture has been extended to support a hybrid deployment model:
1.  **Frontend (Client):** Still supports offline-first capability via IndexedDB, but now integrates with a backend for administrative tasks (API Key management).
2.  **Backend (Server):** A Node.js/Express server acting as the gateway for external tools (e.g., PowerBI) to access data.

## Database Strategy
The backend is designed to support both local development and Azure production environments dynamically.

### Local Development (Default)
- **Engine:** SQLite
- **File:** `server/database.sqlite`
- **Configuration:** No special env vars needed.

### Azure / Production
- **Engine:** MSSQL (Azure SQL Database)
- **Configuration:** Controlled via Environment Variables in Azure App Service.
    - `DB_HOST`: Azure SQL Server URL
    - `DB_USER`: Username
    - `DB_PASS`: Password
    - `DB_NAME`: Database Name

## Deployment Instructions

### Client (Frontend)
- Build: `npm run build`
- Deploy `dist/` folder to Azure Static Web Apps or Azure App Service (Static Content).
- **Env Vars:**
    - `VITE_API_URL`: URL of the deployed Backend (e.g., `https://sitrep-api.azurewebsites.net`).

### Server (Backend)
- Deploy the `server/` directory to Azure App Service (Node.js).
- **Env Vars:**
    - `NODE_ENV`: `production`
    - `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`: Connection details for Azure SQL.
    - `PORT`: `8080` (or let Azure manage it).

## API Authentication
External access to the API (e.g., `/v1/flights`) requires an `X-API-Key` header. These keys are managed in the Admin Portal.
