# Palantir Foundry Deployment Guide

This guide details the step-by-step process to deploy the "SITREP" (USCG AMCR) application into a Palantir Foundry environment. This includes setting up the data backing, the ontology layer, and the React frontend.

## Prerequisites
*   **Foundry Access**: access to `Code Repositories`, `Data Lineage`, `Ontology Management App (OMA)`, and `Carbon` (or `Slate`).
*   **Folder Structure**: Create a project folder `/USCG/SITREP` with subfolders:
    *   `/Raw`: For raw input uploads.
    *   `/Clean`: For intermediate datasets.
    *   `/Ontology`: For final backing datasets.
    *   `/App`: For application artifacts.

---

## Part 1: Data Ingestion (Raw Layer)
Before the pipeline can run, you must upload the raw data files to Foundry to create the input datasets.

1.  **Locate Mock Data**:
    *   I have generated sample CSVs for you in `c:\sitrep\foundry\raw_samples`.
2.  **Upload to Foundry**:
    *   Navigate to your `/USCG/SITREP/Raw` folder in Foundry.
    *   Drag and drop `flights_sample.csv`. Name it `flights_sample`.
    *   Drag and drop `equipment_sample.csv`. Name it `equipment_sample`.
    *   Drag and drop `deployments_sample.csv`. Name it `deployments_sample`.
    *   (Repeat for shipping, inventory, kits, parts_utilization).
3.  **Get the Paths**:
    *   Right-click the new datasets > **Copy Path**.

---

## Part 2: Data Pipeline (Backend)
**Local Source:** `c:\sitrep\foundry\pipeline`

We will create a PySpark pipeline to clean raw USCG data and prepare it for the Object Ontology.

### 1. Code Repository Setup
1.  Navigate to `/USCG/SITREP` in Foundry.
2.  Select **New > Code Repository**.
3.  Choose **Data Transforms (Python)** as the template.
4.  Name it `sitrep-repo` (or `spark-repo`).

### 2. Implementation
**Restructure your Repository:**
To avoid build errors, your repository structure must match the standard python project layout exactly.

1.  **Delete Existing Files**:
    *   In your Foundry Code Repository, delete the existing `transforms` folder entirely to ensure a clean slate.
2.  **Upload New Structure**:
    *   Re-create the folder structure exactly as found in `c:\sitrep\foundry\pipeline\release_v3`.
    *   **Structure**:

    ```
    transforms/
    ├── conda_recipe/
    │   └── meta.yaml
    ├── setup.py         <-- Root Setup
    └── src/
        ├── setup.py     <-- Package Setup
        └── sparkproject/
            ├── __init__.py
            ├── pipeline.py
            └── datasets/
                ├── __init__.py
                └── spark_transforms.py
    ```

3.  **Copy Content**:
    *   Copy files one by one from `c:\sitrep\foundry\pipeline\release_v3\transforms` to the corresponding location in Foundry.

4.  **Update Imports**:
    *   Open `src/sparkproject/pipeline.py`.
    *   Ensure the imports match the folder structure. it should look like:
        ```python
        from sparkproject.datasets import spark_transforms
        ```

5.  **Update Root setup.py**:
    *   Open the `setup.py` at the root of the `transforms` folder.
    *   Ensure it correctly points to the source directory.
        ```python
        setup(
            name='spark-transforms',
            version='0.0.0',
            # ...
            packages=find_packages(where='src'),
            package_dir={'': 'src'}
        )
        ```

6.  **Update Path Constants**:
    *   Open `src/sparkproject/datasets/spark_transforms.py`.
    *   Update `RAW_FLIGHTS_PATH` etc. to match your actual dataset paths in Foundry.

### 3. Build & Materialize
1.  **Commit** your changes.
2.  **Navigate directly** to `src/sparkproject/pipeline.py`.
3.  **Open** that file.
4.  **Click Build** (or "Preview") in the UI to register the transforms.

### Troubleshooting: "No Transforms Discovered"
*   **Action**: Delete the cache file.
*   1. Settings (Gear Icon) -> "Show hidden files".
*   2. Right-click `transforms-shrinkwrap.yml` -> **DELETE**.
*   3. Commit and Build.

---

## Part 3: Ontology Configuration
**Tool:** Ontology Management App (OMA)

### 0. Creating a New Ontology (If None Exists)
If your team does not have an Ontology setup yet (the dropdown is empty or you only see "Ontology" which is read-only), you need to create one.

1.  **Open OMA Settings**:
    *   Open **Ontology Management App**.
    *   In the left sidebar, at the very bottom, click **Settings**.
2.  **Create New Ontology**:
    *   Click **Create new ontology** (usually top right).
    *   **Display Name**: Enter `USCG Ontology` (or your Team Name).
    *   **Description**: "Default ontology for USCG applications."
    *   **Icon**: Select a relevant icon (e.g., a shield or ship).
    *   **Color**: Select a team color (e.g., Blue).
3.  **Permissions**:
    *   Once created, you are the owner. You may need to grant access to other team members via the "Permissions" or "Roles" tab within the Ontology settings.
4.  **Set as Default (Optional)**:
    *   If this is the primary ontology for your work, star it or pin it in your workspace settings.

### 0.5 Data to Ontology Mapping Strategy
**Concept**: In Foundry, an Object Type is backed by a single dataset.
*   **Simple Objects**: For most items (Equipment, Deployments), the **Clean** dataset is sufficient. It is a 1:1 mapping (One row in dataset = One Object).
*   **Complex Objects**: The `FlightEvent` is distinct. We created a specific **Ontology** dataset (`create_flight_objects`) because we needed to **join** existing Equipment data (Aircraft Type) onto the flight log before indexing it.

**Mapping Reference**:
| Object Type | Backing Dataset Path | Reason |
| :--- | :--- | :--- |
| **FlightEvent** | `/USCG/SITREP/Ontology/FlightEvent` | **Joined** (Flight + Equipment Data) |
| **Equipment** | `/USCG/SITREP/Clean/equipment_clean` | Direct 1:1 Map |
| **Deployment** | `/USCG/SITREP/Clean/deployments_clean` | Direct 1:1 Map |
| **Shipping** | `/USCG/SITREP/Clean/shipping_clean` | Direct 1:1 Map |
| **Inventory** | `/USCG/SITREP/Clean/inventory_clean` | Direct 1:1 Map |
| **Kits** | `/USCG/SITREP/Clean/kits_clean` | Direct 1:1 Map |
| **PartsUse** | `/USCG/SITREP/Clean/parts_utilization_clean` | Direct 1:1 Map |

### 1. Accessing the Ontology
1.  **Open OMA**: From the Foundry application portal, click on **Ontology Management App**.
2.  **Select Ontology**:
    *   In the top-left dropdown menu, look for the **USCG Ontology** you just created.
    *   **Select it**.
    *   *Note: If you do not see an Ontology or cannot create objects, contact your Palantir representative to grant "Editor" permissions on the Ontology.*
3.  **Create a New Object Type**:
    *   Once the correct Ontology is loaded, click the **+ New** button in the top right corner.
    *   Select **Object type**.

### 2. Create Object Type: `FlightEvent`
1.  **Define Backing Data**:
    *   In the creation wizard, search for and select your specific backing dataset: `/USCG/SITREP/Ontology/FlightEvent`.
    *   *Tip: Ensure this dataset has successfully built in the Data Lineage tool first.*
2.  **Configure Basics**:
    *   **Display Name**: Enter `Flight Event`.
    *   **Plural Name**: Enter `Flight Events`.
    *   **API Name**: Ensure this is `FlightEvent` (Case Sensitive).
3.  **Map Properties**:
    *   **Primary Key**: Select `mission_number` (or `primaryKey`) from the dropdown. This MUST be unique.
    *   **Title Property**: Select `mission_number` or construct a template like `Mission {{mission_number}}`.
    *   **Critical Properties to Map**:
        *   `mission_number` (String)
        *   `date` (Date)
        *   `status` (String)
        *   `flight_hours` (Double)
        *   `aircraft_type` (String)
        *   `launcher` (String)
        *   `number_of_launches` (Integer)
        *   `contraband_lbs` (Double)
        *   `detainees` (Integer)
        *   `reason_for_cancel` (String)
        *   `responsible_party` (String)
        *   *Map all other available columns as needed.*
4.  **Save**: Click **Save** in the top right.

### 3. Create Object Type: `Equipment`
1.  **Define Backing Data**:
    *   Select dataset: `/USCG/SITREP/Clean/equipment_clean`.
2.  **Configure Basics**:
    *   **Display Name**: `Equipment`.
    *   **API Name**: `Equipment`.
3.  **Map Properties**:
    *   **Primary Key**: Select `serial_number`.
    *   **Title Property**: `serial_number`.
    *   **Status Property**: Ensure `status` is mapped to a String.
4.  **Formatting (Optional)**:
    *   Go to the **Properties** tab.
    *   Click on the `status` property.
    *   Add **Conditional Formatting**: Set "FMC" to Green, "NMC" to Red.
5.  **Save**.

### 4. Configure Actions (Writeback)
To enable the React App to save data back to Foundry, you must define an **Action**.

1.  **Create Action**:
    *   In OMA, select the **Actions** tab (left sidebar).
    *   Click **+ New Action Type**.
2.  **Define Rules**:
    *   **Name**: `Log Flight`.
    *   **API Name**: `logFlight` (This is what the SDK calls).
    *   **Rule**: Select **Create new Object**.
    *   **Target Object**: Select `FlightEvent`.
3.  **Set Parameters**:
    *   The wizard will automatically suggest parameters based on the object's properties.
    *   Ensure each form field (Date, Aircraft, Hours, etc.) maps to a parameter.
4.  **Save & Publish**:
    *   Click **BS** (Save) and then create a release to publish the changes.

---

## Part 4: Frontend Application (Carbon)
**Local Source:** `c:\sitrep\foundry\app`

The modern way to host full React applications in Foundry is via **Carbon** (managed container/static hosting).

### Method: Deploy to Carbon
This acts as a standard static web host.

1.  **Build Local Artifacts**:
    *   Ensure you have run `npm run build` in `c:\sitrep\foundry\app`.
    *   Verify the `dist` folder exists.

2.  **Create Carbon Workspace**:
    *   In Foundry, go to **Carbon > New Module**.
    *   Select **React Application**.

3.  **Upload Assets**:
    *   Upload the contents of the `dist` folder (index.html, assets/, etc.) to the Carbon module's file area.

4.  **Configure Entry Point**:
    *   Set the **Web Root** to `index.html`.
    *   Set **Routing** to "History API Fallback" (since this relies on React Router).

5.  **Environment Variables**:
    *   If connecting to Ontology Actions, set `VITE_FOUNDRY_API_URL` to your Foundry stack URL.

---

## Part 5: Wiring Frontend to Ontology
To make the application fully functional with Foundry data:

1.  **Install Foundry SDK**:
    *   `npm install @osdk/client @osdk/oauth`
2.  **Replace IndexDB**:
    *   Modify `client/src/db/flights.js` to use the OSDK `client.ontology.objects.FlightEvent.fetch()` instead of local queries.
    *   Modify save functions (e.g., `handleSave`) to call `client.ontology.actions.logFlight({ ... })`.

## Verification
- **Pipeline**: Green checks in Data Lineage for all transforms.
- **Ontology**: Objects visible in Object Explorer.
- **App**: Accessible via the Carbon URL (e.g., `https://<stack>/carbon/preview/<id>`).
