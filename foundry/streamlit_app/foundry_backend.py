import requests
import pandas as pd
import json
import os
from io import StringIO
from typing import Optional, Dict, Any

class FoundryBackend:
    def __init__(self, config_path: str = "foundry_config.json"):
        self.config = self._load_config(config_path)
        self.base_url = self.config.get("FOUNDRY_URL", "").rstrip("/")
        self.token = self.config.get("FOUNDRY_TOKEN", "")
        self.datasets = self.config.get("DATASETS", {})
        
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def _load_config(self, path: str) -> Dict[str, Any]:
        if not os.path.exists(path):
            return {}
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading config: {e}")
            return {}
            
    def is_configured(self) -> bool:
        mode = self.config.get("MODE", "local").lower()
        return mode == "foundry" and bool(self.base_url and self.token and self.datasets)

    def get_dataset_rid(self, name: str) -> Optional[str]:
        return self.datasets.get(name)

    def read_dataset(self, dataset_name: str) -> pd.DataFrame:
        """
        Reads a dataset from Foundry using the Dataset API (export to CSV).
        """
        rid = self.get_dataset_rid(dataset_name)
        if not rid:
            print(f"Dataset {dataset_name} not configured.")
            return pd.DataFrame()
            
        # Using the standard Foundry Datasets API to read the latest transaction's file
        # Flow: Get Schema -> Read Table (Simplification: Use read endpoint if available or export)
        # NOTE: The simplest standard pattern for external apps is `GET /api/v1/datasets/{rid}/read` (CSV)
        # Assuming Data Proxy or similar convenient endpoint exists. 
        # For strict API: POST /api/v1/datasets/{rid}/read (JSON/CSV)
        
        url = f"{self.base_url}/api/v1/datasets/{rid}/read?format=csv"
        
        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                return pd.read_csv(StringIO(response.text))
            else:
                print(f"Failed to fetch {dataset_name}: {response.status_code} - {response.text}")
                return pd.DataFrame()
        except Exception as e:
            print(f"Error fetching {dataset_name}: {e}")
            return pd.DataFrame()

    def write_record(self, dataset_name: str, record: Dict[str, Any]) -> bool:
        """
        Writes a single record to Foundry. 
        WARNING: Direct API write usually implies appending a transaction.
        """
        # This is complex in raw API. 
        # 1. Create Transaction (POST /api/v1/datasets/{rid}/transactions)
        # 2. Upload File (PUT /api/v1/datasets/{rid}/transactions/{txId}/files/{filename})
        # 3. Commit Transaction (POST /api/v1/datasets/{rid}/transactions/{txId}/commit)
        # Implementing simplified Mock for 'write' part unless user demands full Tx logic.
        print("Writeback via raw API requires Transaction orchestration. Implement fully if needed.")
        return False
