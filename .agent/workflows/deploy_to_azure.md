---
description: How to deploy SITREP to Azure App Services and Azure SQL Database
---

# Deploying SITREP to Azure

This guide covers deploying the Node.js backend to **Azure App Service**, the data to **Azure SQL Database**, and the React frontend to **Azure Static Web Apps**.

## Prerequisites
1.  **Azure Account**: You need an active Azure subscription.
2.  **Azure CLI**: Installed and authenticated (`az login`).
3.  **GitHub Repository**: Your code should be pushed to a GitHub repository (this makes deployment significantly easier via Actions).

---

## Part 1: Database Setup (Azure SQL)

1.  **Create a Resource Group**:
    ```bash
    az group create --name SitrepResourceGroup --location eastus
    ```

2.  **Create SQL Server**:
    Replace `<admin-user>` and `<password>` with secure credentials.
    ```bash
    az sql server create --name sitrep-sql-server --resource-group SitrepResourceGroup --location eastus --admin-user <admin-user> --admin-password <password>
    ```

3.  **Create Database**:
    ```bash
    az sql db create --resource-group SitrepResourceGroup --server sitrep-sql-server --name sitrep-db --service-objective S0
    ```

4.  **Allow Azure Services Access**:
    This allows the App Service to connect to the SQL Server.
    ```bash
    az sql server firewall-rule create --resource-group SitrepResourceGroup --server sitrep-sql-server --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
    ```

---

## Part 2: Backend Deployment (Azure App Service)

1.  **Create App Service Plan**:
    ```bash
    az appservice plan create --name SitrepServicePlan --resource-group SitrepResourceGroup --sku B1 --is-linux
    ```

2.  **Create Web App**:
    ```bash
    az webapp create --resource-group SitrepResourceGroup --plan SitrepServicePlan --name sitrep-api --runtime "NODE:18-lts"
    ```

3.  **Configure Environment Variables**:
    Set the credentials you defined in Part 1.
    ```bash
    az webapp config appsettings set --resource-group SitrepResourceGroup --name sitrep-api --settings \
      DB_HOST="sitrep-sql-server.database.windows.net" \
      DB_NAME="sitrep-db" \
      DB_USER="<admin-user>" \
      DB_PASS="<password>" \
      NODE_ENV="production"
    ```

4.  **Deploy Code**:
    *Check the `server` directory deployment.*
    If deploying via **GitHub Actions** (Recommended):
    - Go to your App Service in Azure Portal -> Deployment Center.
    - Select GitHub -> Select your Repo.
    - **Important**: Configure the Build Context to be the `server` directory, not root.

    *Manual Zip Deploy (Alternative)*:
    ```bash
    cd server
    # Install dependencies to generate lockfile if missing
    npm install
    # Zip contents (exclude node_modules)
    Compress-Archive -Path * -DestinationPath ../server.zip
    # Deploy
    az webapp deployment source config-zip --resource-group SitrepResourceGroup --name sitrep-api --src ../server.zip
    ```

5.  **Verify**: Access `https://sitrep-api.azurewebsites.net/health`. It should return `OK`.

---

## Part 3: Frontend Deployment (Azure Static Web Apps)

1.  **Create Static Web App**:
    ```bash
    az staticwebapp create --name sitrep-client --resource-group SitrepResourceGroup --location eastus --source https://github.com/<your-user>/<your-repo> --branch main --app-location "client" --output-location "dist" --login-with-github
    ```

2.  **Configure Environment Variables**:
    The frontend needs to know where the backend is.
    
    *   Go to Azure Portal -> Static Web App -> Configuration.
    *   Add `VITE_API_URL` with value `https://sitrep-api.azurewebsites.net`.
    *   Save.

3.  **Routing Configuration**:
    Ensure your `client` folder has a `staticwebapp.config.json` (if managing routing manually) or rely on the default React setup. Azure Static Web Apps automatically handles SPA routing if detected, but a `staticwebapp.config.json` is recommended for fallback.

    *Create `client/staticwebapp.config.json`*:
    ```json
    {
      "navigationFallback": {
        "rewrite": "/index.html"
      }
    }
    ```

---

## Part 4: Final Connection

1.  **CORS Setup**:
    The backend needs to allow requests from the frontend.
    *   Get your Static Web App URL (e.g., `https://brave-cliff-0000.azurestaticapps.net`).
    *   Go to Azure Portal -> App Service (sitrep-api) -> CORS.
    *   Add the Static Web App URL to the Allowed Origins list.
    *   Save.

2.  **Test**: Open your frontend URL. The application should load and successfully communicate with the backend API.
