# SITREP - Azure Deployment Guide

This document outlines the steps to deploy the SITREP application to the Microsoft Azure Cloud. The architecture consists of a Node.js Backend (App Service), a React Frontend (Static Web Apps), and an Azure SQL Database.

## 1. Prerequisites

*   **Azure Account**: You need an active Azure subscription.
*   **Azure CLI**: Installed on your local machine for command-line deployment (optional but recommended).
*   **Deployment Code**: This repository.

## 2. Infrastructure Setup

Create the following resources in the [Azure Portal](https://portal.azure.com/):

### A. Resource Group
1.  Create a new **Resource Group** (e.g., `rg-sitrep-prod-eastus`).
2.  Region: `East US` (or your preferred region).

### B. Azure SQL Database
1.  Create a **SQL Server** (logical server).
    *   Auth: Use "SQL authentication" or "Microsoft Entra authentication".
    *   Note down the *Server Name* (e.g., `sql-sitrep.database.windows.net`) and *Admin Login/Password*.
2.  Create a **SQL Database** within that server.
    *   Name: `sitrep_db` (or similar).
    *   Compute Tier: "Basic" or "Standard S0" is sufficient for initial usage.
3.  **Firewall Rules**:
    *   Allow Azure Services and resources to access this server: **Yes**.
    *   Add your client IP (for local debugging if needed).

### C. Azure App Service (Backend)
1.  Create a **Web App**.
2.  Publish: **Code**.
3.  Runtime Stack: **Node 18 LTS** (or 20 LTS).
4.  OS: **Linux**.
5.  Region: Same as Resource Group.
6.  Plan: **Basic B1** (or Free F1 for testing, though B1 is recommended for reliability).
7.  **Configuration (Environment Variables)**:
    *   Go to **Settings > Environment variables**.
    *   Add the following:
        *   `DB_HOST`: `<your-sql-server-name>.database.windows.net`
        *   `DB_USER`: `<your-sql-admin-username>`
        *   `DB_PASS`: `<your-sql-admin-password>`
        *   `DB_NAME`: `sitrep_db`
        *   `ADMIN_EMAIL`: `matt.davis@shield.ai` (or your primary admin email).
        *   `PORT`: `8080` (Azure default, or let it auto-detect).

### D. Azure Static Web App (Frontend)
1.  Create a **Static Web App**.
2.  Plan Type: **Standard** (Required for custom Authentication/Authorization features if we move beyond free tier specific auth). **Free** is okay for basic start.
3.  Deployment Details:
    *   Source: **GitHub/Azure DevOps** (Connect your repo).
    *   Build Presets: **React**.
    *   App Location: `/client`
    *   Api Location: (Leave empty, we are using a separate App Service).
    *   Output Location: `dist`
4.  **Configuration**:
    *   Go to **Settings > Environment variables**.
    *   Add the following:
        *   `VITE_AUTH_MODE`: `microsoft`
        *   `VITE_API_URL`: `https://<your-app-service-name>.azurewebsites.net` (The URL of the App Service created in step C).
        *   `VITE_AZURE_CLIENT_ID`: (See Step 3).
        *   `VITE_AZURE_TENANT_ID`: (See Step 3).

## 3. Authentication (Microsoft Entra ID) setup

### A. App Registration
1.  Go to **Microsoft Entra ID** -> **App registrations**.
2.  **New Registration**:
    *   Name: `SITREP-App`.
    *   Supported account types: Single tenant (My organization only).
    *   Redirect URI (SPA): `https://<your-static-web-app-url>.azurestaticapps.net` (Add your Localhost `http://localhost:5173` here for dev too).
3.  **Overview**: Copy the **Application (client) ID** and **Directory (tenant) ID**.
4.  **Authentication**:
    *   Enable Access Tokens and ID Tokens (Implicit/Hybrid flows) if needed, but for MSAL v2 (current), standard Code Flow with PKCE is used.
5.  **API Permissions**:
    *   Add `User.Read` (delegated).
    *   Grant Admin Consent for your org.

### B. Update Static Web App Config
Update the Environment Variables in your Static Web App with the IDs from above:
*   `VITE_AZURE_CLIENT_ID`
*   `VITE_AZURE_TENANT_ID`

## 4. Deploying Code

### Backend (App Service)
You can deploy via VS Code Azure Tools extension or Zip Deploy.

**Zip Deploy Method**:
1.  Navigate to `server/`.
2.  Run `npm install`.
3.  Zip the contents of `server/` (ensure `package.json` is at root of zip).
4.  Use Azure CLI: `az webapp deployment source config-zip --resource-group <rg-name> --name <app-name> --src deployment.zip`

### Frontend (Static Web App)
If you connected GitHub/DevOps in Step 2D, pushing to your branch will trigger the build and deploy pipeline automatically.

## 5. Verification

1.  Navigate to the Static Web App URL.
2.  You should see the Microsoft Login prompt (since `VITE_AUTH_MODE` is `microsoft`).
3.  After login, check the Network tab. Calls to `/v1/deployments` (etc.) should go to your App Service URL and include a `Authorization: Bearer ...` token.

## 6. Access Control

The first user defined in `ADMIN_EMAIL` (Backend Env Var) or `defaultAdmin` (Frontend Config) is the bootstrap admin. Use this account to log in and grant roles to other users via the Admin Portal.
