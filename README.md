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
*   **Offline-First Architecture:** Built with `Dexie.js` (IndexedDB), the client works fully offline. Data is stored locally and syncs to the central database when connectivity is restored.
*   **Role-Based Access:** Granular permissions for Admins, Editors, and Deployers (restricted view).
*   **Excel Integration:** Import/Export capabilities for inventory and equipment lists.
*   **Financial Tracking:** basic contract line item number (CLIN) tracking (if enabled).

---

## 🛠️ Technology Stack

### Frontend (`/client`)
*   **Framework:** React 18 (Vite)
*   **State/Data:** `Deixe.js` (IndexedDB wrapper) for local storage.
*   **Styling:** Tailwind CSS + Lucide React Icons.
*   **Auth:** MSAL (Microsoft Authentication Library) / Local Auth fallback.
*   **Visualization:** Recharts for data analytics.

### Backend (`/server`)
*   **Runtime:** Node.js & Express.
*   **Database ORM:** Sequelize.
*   **Databases Supported:** 
    *   **Development/Local:** SQLite (`database.sqlite`).
    *   **Production:** Azure SQL Database (MSSQL).
*   **Security:** API Key authentication for external integrations.

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
The server provides the API and handles synchronization with the central SQL database.

```bash
cd server
npm install

# Create a .env file (or rely on defaults/sqlite)
# cp .env.example .env

# Start the server (Runs on port 3001)
npm run dev
```

### 3. Setup Frontend (Client)
The client is the main user interface.

```bash
cd ../client
npm install

# Start the development server (Runs on port 5173)
npm run dev
```

Access the application at `http://localhost:5173`.

---

## ☁️ Deployment

The application is designed to be deployed to **Azure**:

*   **Frontend:** Azure Static Web Apps.
*   **Backend:** Azure App Service (Linux/Node).
*   **Database:** Azure SQL Database.

For detailed deployment instructions, please refer to the [Deployment Workflow](.agent/workflows/deploy_to_azure.md).

---

## 🛡️ Admin Portal

The application includes a built-in Admin Portal for authorized users:
*   **User Management:** Grant `Editor`, `Deployer`, or `Admin` roles.
*   **Deployment Assignment:** Restrict `Deployer` roles to specific deployments.
*   **Backups:** Export/Import full system state via JSON (critical for transferring data between offline devices).
*   **API Keys:** Generate secure keys for external tools (e.g., PowerBI) to access the backend API.

---

## 🤝 Contributing

1.  Create a feature branch (`git checkout -b feature/amazing-feature`).
2.  Commit your changes (`git commit -m 'Add some amazing feature'`).
3.  Push to the branch (`git push origin feature/amazing-feature`).
4.  Open a Pull Request.

---

## 📄 License
Shield AI / Proprietary - Internal Use Only.
