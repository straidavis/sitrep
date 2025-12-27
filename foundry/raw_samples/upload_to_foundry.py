import os
import json
import requests
import argparse
from typing import Dict, Optional

# --- CONFIG ---
# Map Filename (in this dir) -> Config Key (in foundry_config.json)
FILE_MAP = {
    "flights_sample.csv": "flights",
    "equipment_sample.csv": "equipment",
    "deployments_sample.csv": "deployments",
    "inventory_sample.csv": "inventory",
    "parts_utilization_sample.csv": "parts_utilization",
    "kits_sample.csv": "kits",
    "shipping_sample.csv": "shipping",
    "service_bulletins_sample.csv": "service_bulletins",
    "shipment_items_sample.csv": "shipment_items",
    "kit_items_sample.csv": "kit_items",
    "parts_catalog_sample.csv": "parts_catalog"
}

CONFIG_PATH = "../streamlit_app/foundry_config.json"

class FoundryClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def create_dataset(self, parent_rid: str, name: str) -> Optional[str]:
        """Creates a dataset in the given parent folder and returns its RID."""
        url = f"{self.base_url}/api/v1/datasets"
        payload = {
            "parentFolderRid": parent_rid,
            "name": name
        }
        try:
            resp = requests.post(url, headers=self.headers, json=payload)
            if resp.status_code == 200:
                return resp.json().get("rid")
            else:
                print(f"Failed to create dataset '{name}': {resp.text}")
                return None
        except Exception as e:
            print(f"Error creating dataset '{name}': {e}")
            return None

    def upload_dataset_file(self, rid: str, file_path: str):
        """Replaces dataset content with file content (Snapshot)."""
        filename = os.path.basename(file_path)
        
        # 1. Start Transaction
        tx_url = f"{self.base_url}/api/v1/datasets/{rid}/transactions"
        tx_payload = {"branchName": "master", "transactionType": "SNAPSHOT"}
        
        try:
            tx_resp = requests.post(tx_url, headers=self.headers, json=tx_payload)
            if tx_resp.status_code != 200:
                print(f"Failed to start tx for {rid}: {tx_resp.text}")
                return
            
            tx_id = tx_resp.json().get("rid")
            
            # 2. Upload File
            # Content-Type for file upload
            upload_headers = self.headers.copy()
            upload_headers["Content-Type"] = "application/octet-stream" # or text/csv
            
            with open(file_path, 'rb') as f:
                data = f.read()
                
            put_url = f"{self.base_url}/api/v1/datasets/{rid}/transactions/{tx_id}/files/{filename}"
            put_resp = requests.post(put_url, headers=upload_headers, data=data) # API usually uses POST or PUT for file? Check params.
            # V1 API: POST .../files/{path}
            
            if put_resp.status_code != 200:
                print(f"Failed to upload file {filename}: {put_resp.text}")
                return

            # 3. Commit
            commit_url = f"{self.base_url}/api/v1/datasets/{rid}/transactions/{tx_id}/commit"
            commit_resp = requests.post(commit_url, headers=self.headers)
            
            if commit_resp.status_code == 200:
                print(f"✅ Successfully uploaded {filename} to {rid}")
            else:
                print(f"Failed to commit tx for {rid}: {commit_resp.text}")

        except Exception as e:
            print(f"Error during upload for {rid}: {e}")

def main():
    parser = argparse.ArgumentParser(description="Upload samples to Foundry")
    parser.add_argument("--folder", help="Target Parent Folder RID (for creating new datasets)", required=False)
    parser.add_argument("--url", help="Foundry URL (overrides config)", required=False)
    parser.add_argument("--token", help="Foundry Token (overrides config)", required=False)
    args = parser.parse_args()
    
    # 1. Load Config
    if not os.path.exists(CONFIG_PATH):
        print(f"Config not found at {CONFIG_PATH}")
        return
        
    with open(CONFIG_PATH, 'r') as f:
        config = json.load(f)
        
    # Resolution Order: Arg -> Env -> Config
    url = args.url or os.environ.get("FOUNDRY_URL") or config.get("FOUNDRY_URL")
    token = args.token or os.environ.get("FOUNDRY_TOKEN") or config.get("FOUNDRY_TOKEN")
    
    mode = config.get("MODE", "local")
    print(f"Loaded Config (Mode: {mode})")
    
    if not url or not token:
        print("❌ Error: Missing URL or TOKEN.")
        print("  - If MODE is 'foundry_internal', you must provide --url and --token arguments (or set env vars) as the config likely omits them.")
        print("  - If MODE is 'foundry', ensure they are set in the config file.")
        return
        
    # ... rest of script logic ...
    
    client = FoundryClient(url, token)
    
    updated_datasets = datasets = config.get("DATASETS", {})
    
    # Check if we need to sync RIDs (e.g. if config has placeholder 'ri.foundry...mock-rid')
    # Use FILE_MAP keys to drive the iteration so we only upload what we have files for.
    
    print(f"Processing {len(FILE_MAP)} files...")
    
    for filename, key in FILE_MAP.items():
        if not os.path.exists(filename):
            # print(f"Skipping {filename} (File not found)") 
            # Optional: Warning only
            continue
            
        rid = datasets.get(key)
        
        # Check if replacement needed
        is_mock = not rid or "mock-rid" in rid
        
        if is_mock:
            target_folder = args.folder or config.get("FOUNDRY_SAMPLES_FOLDER_RID")
            
            if not target_folder or "update-me" in target_folder:
                print(f"⚠️  Skipping {key}: RID is mock/missing and no valid Folder RID provided (Arg or Config).")
                continue
            
            print(f"Creating new dataset for {key} in {target_folder}...")
            new_rid = client.create_dataset(target_folder, f"SITREP_{key}")
            if new_rid:
                rid = new_rid
                updated_datasets[key] = rid
                print(f"  -> Created {rid}")
            else:
                continue
        
        # Upload
        print(f"Uploading {filename} to {rid}...")
        client.upload_dataset_file(rid, filename)
        
    # Save Config Update
    config["DATASETS"] = updated_datasets
    # Preserve original mode/keys
    
    with open(CONFIG_PATH, 'w') as f:
        json.dump(config, f, indent=4)
        
    print("------------------------------------------------")
    print("✅ Done. Config processed.")
    
if __name__ == "__main__":
    main()
