from datetime import date
from typing import Dict, Any, List

class MockDB:
    def __init__(self):
        # Initialize session state for DB if not exists
        import streamlit as st
        import pandas as pd
        if 'db_state' not in st.session_state:
            st.session_state['db_state'] = {
                'flights': pd.DataFrame(), # Will be populated by initial load
                'equipment': pd.DataFrame(),
                'inventory': pd.DataFrame(),
                'kits': pd.DataFrame(),
                'service_bulletins': pd.DataFrame(),
                'parts_utilization': pd.DataFrame()
            }
            
    def get_table(self, table_name: str):
        import streamlit as st
        return st.session_state['db_state'].get(table_name)
        
    def add_record(self, table_name: str, record: Dict[str, Any]):
        import streamlit as st
        import pandas as pd
        
        df = st.session_state['db_state'].get(table_name)
        if df is not None:
            # Add simple ID if not present
            if 'id' not in record:
                record['id'] = len(df) + 1000 # Offset to distinguish from initial mock
                
            new_row = pd.DataFrame([record])
            st.session_state['db_state'][table_name] = pd.concat([df, new_row], ignore_index=True)
            return True
        return False
        
    def update_record(self, table_name: str, record_id: int, updates: Dict[str, Any]):
        import streamlit as st
        df = st.session_state['db_state'].get(table_name)
        if df is not None and 'id' in df.columns:
            # Find index
            idx = df[df['id'] == record_id].index
            if len(idx) > 0:
                for col, val in updates.items():
                    st.session_state['db_state'][table_name].at[idx[0], col] = val
                return True
        return False
