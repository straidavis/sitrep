# Operations Planning & Tracking System (SITREP)

**SITREP** (Situation Report) is a comprehensive, offline-capable web application designed to manage deployments, aviation operations, and inventory logistics for complex field operations.

## 🚀 Overview

This application bridges the gap between field operations and command oversight. It allows deployed personnel to track:
*   **Deployments:** Manage schedules, locations, and personnel assignments.
*   **Aviation Logs:** Record flight hours, mission details, and aircraft status (FMC/NMC).
*   **AMCR:** Automatically generate Aircraft Materiel Condition Reports.
*   **Inventory & Logistics:** Track parts, kits, and master inventory levels.
*   **Equipment Status:** Monitor the operational status of all deployed assets.

### Key Features
*   **Dual-Mode Architecture:**
    *   **Cloud Mode:** Hosted on Azure with centralized SQL database and SSO (Microsoft 365) authentication.
    *   **Offline/Local Mode:** capable of running fully offline using `Dexie.js` (IndexedDB) with manual sync capabilities for standalone or air-gapped deployments.
*   **Role-Based Access:** Granular permissions for Admins, Editors, and Deployers.
*   **Excel Integration:** Import/Export capabilities for inventory and equipment lists.
*   **Financial Tracking:** Basic contract line item number (CLIN) tracking.

---

## 🛠️ Technology Stack

### Frontend (`/client`)
*   **Framework:** React 18 (Vite)
*   **Hosting:** Azure Static Web Apps (Cloud) OR Electron/Local Server (Offline).
*   **State/Data:** Hybrid approach - uses API for online mode, `Dexie.js` for offline/local mode.
*   **Styling:** Tailwind CSS + Lucide React Icons.
*   **Auth:** MSAL (Azure AD) for Cloud, Local Hash/Store for offline.
*   **Visualization:** Recharts for data analytics.

### Backend (`/server`)
*   **Runtime:** Node.js & Express.
*   **Hosting:** Azure App Service (Linux).
*   **Database ORM:** Sequelize.
*   **Databases Supported:** 
    *   **Production:** Azure SQL Database (MSSQL).
    *   **Local/Offline:** SQLite (`database.sqlite`).
*   **Security:** Bearer Token (JWT) validation for SSO users & API Key support.

---

## 📦 Installation & Setup

### Prerequisites
*   Node.js (v18+ recommended)
*   npm or yarn
*   Git

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/sitrep.git
cd sitrep
```

### 2. Setup Backend (Server)
```bash
cd server
npm install

# Create a .env file based on environment
# For Local Dev/SQLite:
# cp .env.example .env

# Start the server (Runs on port 3001)
npm run dev
```

### 3. Setup Frontend (Client)
```bash
cd ../client
npm install

# Start the development server (Runs on port 5173)
npm run dev
```

By default, the app runs in **Local Mode**. To test Cloud/Microsoft Mode locally, update your `.env` in `client/`:
```env
VITE_AUTH_MODE=microsoft
VITE_API_URL=http://localhost:3001
VITE_AZURE_CLIENT_ID=<your-client-id>
VITE_AZURE_TENANT_ID=<your-tenant-id>
```

---

## ☁️ Deployment

For detailed, step-by-step instructions on deploying SITREP to Azure, please refer to:
👉 **[AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md)**

High-level architecture:
*   **Frontend:** Azure Static Web Apps
*   **Backend:** Azure App Service
*   **Database:** Azure SQL

---

## 🛡️ Admin Portal

The application includes a built-in Admin Portal:
*   **User Management:** Edit roles and permissions.
*   **Backups:** JSON Export/Import for system state.
*   **API Keys:** Manage keys for external integrations.

---

## 📄 License
Shield AI / Proprietary - Internal Use Only.
