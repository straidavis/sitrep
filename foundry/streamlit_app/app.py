import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import numpy as np
from datetime import datetime, timedelta, date

from validators import validate_flight_import, CANCELLATION_REASONS
from mock_db import MockDB
from models import Flight




# ==========================================
# CONFIGURATION
# ==========================================
st.set_page_config(
    page_title="S.P.A.R.K.",
    page_icon="logo.png",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- HEADER (Branding) ---
try:
    c_brand1, c_brand2 = st.columns([1, 15])
    with c_brand1:
        st.image("logo.png", width=65)
    with c_brand2:
         st.markdown("""
            <h1 style='padding-top: 0px; margin-bottom: -10px; font-size: 3rem;'>S.P.A.R.K.</h1>
            <span style='font-size: 1.2em; font-weight: bold; color: #888;'>Status, Parts, Aircraft Readiness & Kits</span>
         """, unsafe_allow_html=True)
except Exception:
    st.title("S.P.A.R.K.")
    st.caption("Status, Parts, Aircraft Readiness & Kits")

# Initialize MockDB (Single Instance per Session)
if 'mock_db' not in st.session_state:
    st.session_state['mock_db'] = MockDB()
    
db = st.session_state['mock_db']

# Custom CSS for "Premium" Dark Mode 
st.markdown("""
    <style>
    /* Metric Cards */
    .metric-card {
        background-color: #1E1E1E;
        padding: 20px;
        border-radius: 8px;
        border: 1px solid #333;
        margin-bottom: 15px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    .metric-label { font-size: 0.9em; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric-value { font-size: 2em; font-weight: bold; color: #EEE; }
    .metric-sub { font-size: 0.8em; color: #666; }

    /* Status Badges */
    .badge-fmc { background-color: rgba(76, 175, 80, 0.2); color: #4CAF50; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8em; }
    .badge-nmc { background-color: rgba(244, 67, 54, 0.2); color: #F44336; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8em; }
    .badge-pmc { background-color: rgba(255, 193, 7, 0.2); color: #FFC107; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8em; }
    
    /* Headers */
    h1, h2, h3 { color: #E0E0E0; }
    
    /* Input Styling */
    div[data-baseweb="input"] { background-color: #2D2D2D !important; border-color: #444 !important; color: #EEE !important; }
    
    /* Navigation Menu Styling */
    div[data-testid="stSidebarNav"] { display: none; } 
    
    /* Minimize Top Padding */
    .block-container {
        padding-top: 10px !important;
        padding-bottom: 1rem !important;
        margin-top: 0px !important;
    }
    
    /* Compact Header */
    header { visibility: hidden; } /* Hide the hamburger menu header if desired, or just move content up */
    .main > div { padding-top: 0rem; } 
    
    /* Full width buttons in sidebar */
    section[data-testid="stSidebar"] button {
        width: 100%;
        border: none;
        background-color: transparent;
        color: #EEE;
        transition: background 0.3s;
        
        /* Strict Flex Alignment */
        display: flex !important;
        justify-content: flex-start !important; /* Force Left */
        align-items: center !important;
    }
    
    /* Target the INTERNAL styling of the button to remove centering */
    section[data-testid="stSidebar"] button > div {
        justify-content: start !important;
        text-align: left !important;
        width: 100% !important;
    }

    /* Target the text container specifically */
    section[data-testid="stSidebar"] button div[data-testid="stMarkdownContainer"] p {
        text-align: left !important;
        margin: 0;
        padding-left: 10px;
        font-size: 1.05rem;
        width: 100%;
    }
    
    /* SILHOUETTE ICON HACK */
    section[data-testid="stSidebar"] button {
        filter: grayscale(100%) brightness(1.2); 
    }

    section[data-testid="stSidebar"] button:hover {
        background-color: #333;
        color: #FFF;
        filter: grayscale(0%) brightness(1.0); 
    }
    
    section[data-testid="stSidebar"] button:active {
        background-color: #444;
        color: #FFF;
    }
    
    /* Active Button styling */
    section[data-testid="stSidebar"] button[kind="primary"] {
        background-color: #333 !important;
        color: #FFF !important;
        border-left: 4px solid #4CAF50 !important;
        filter: none !important; 
    }
    </style>
    """, unsafe_allow_html=True)

from foundry_backend import FoundryBackend

# ...

# Datasets RIDs (Reference for Load Logic)
# (Used within Backend or Mock)
DATASETS = {
    "flights": "ri.foundry.main.dataset.8c2b1cb4-b9a7-47ac-91e5-f4fd20d6b603",
    "equipment": "ri.foundry.main.dataset.6fe48ad7-c0c9-45a6-b1fa-f398ea5b83a5",
    "deployments": "ri.foundry.main.dataset.73cbe733-dd1f-427e-907d-d147483fc4bc",
    "inventory": "ri.foundry.main.dataset.0237456f-b4d2-4fc2-b105-d4908e97a815",
    "parts_utilization": "ri.foundry.main.dataset.1d21f9e4-c99e-444d-b1cc-8785ea0b3222",
    "kits": "ri.foundry.main.dataset.c32685a4-e09c-4f8f-be88-425122caea7f",
    "shipping": "ri.foundry.main.dataset.89309691-6ecf-4281-a0b4-256bb33979bf",
    "service_bulletins": "ri.foundry.main.dataset.sb-mock-rid",
    "shipment_items": "ri.foundry.main.dataset.shipment-items-mock-rid",
    "kit_items": "ri.foundry.main.dataset.kit-items-mock-rid",
    "parts_catalog": "ri.foundry.main.dataset.parts-catalog-mock-rid"
}

def load_data_initial():
    """
    Loads initial data into Session State.
    Switches between Foundry API (if configured) and Mock Data.
    """
    # Check if already loaded
    if 'data_loaded' in st.session_state and st.session_state['data_loaded']:
        return

    # Try Backend
    backend = FoundryBackend()
    use_api = backend.is_configured()
    
    if use_api:
        st.toast("Connecting to Foundry API...")
        try:
            # Load Tables
            st.session_state['db_state']['flights'] = backend.read_dataset("flights")
            st.session_state['db_state']['equipment'] = backend.read_dataset("equipment")
            st.session_state['db_state']['deployments'] = backend.read_dataset("deployments")
            st.session_state['db_state']['inventory'] = backend.read_dataset("inventory")
            st.session_state['db_state']['service_bulletins'] = backend.read_dataset("service_bulletins")
            st.session_state['db_state']['kits'] = backend.read_dataset("kits")
            st.session_state['db_state']['shipping'] = backend.read_dataset("shipping")
            st.session_state['db_state']['shipment_items'] = backend.read_dataset("shipment_items")
            st.session_state['db_state']['parts_utilization'] = backend.read_dataset("parts_utilization")
            st.session_state['db_state']['kit_items'] = backend.read_dataset("kit_items")
            st.session_state['db_state']['parts_catalog'] = backend.read_dataset("parts_catalog")
            
            # Basic validation to fallback if API fails
            if st.session_state['db_state']['flights'].empty:
                st.warning("API returned empty data. Switching to Mock for Demo.")
                use_api = False
            else:
                st.session_state['data_source'] = "Foundry API"
        except Exception as e:
             st.error(f"API Connection Failed: {e}")
             use_api = False
    
    if not use_api:
        st.session_state['data_source'] = "Mock Data"
        populate_mock_data()
        
    st.session_state['data_loaded'] = True


def populate_mock_data():
    # 1. Flights
    flights_data = pd.DataFrame({
        "id": range(1, 15),
        "mission_number": [f"M-202512{i:02d}-01" for i in range(1, 15)],
        "date": [datetime(2025, 12, i).date() for i in range(1, 15)],
        "aircraft_number": ["VBAT-001", "VBAT-002", "VBAT-001", "VBAT-003"] * 3 + ["VBAT-001", "VBAT-002"],
        "status": ["COMPLETE", "COMPLETE", "ABORTED", "COMPLETE", "DELAY", "COMPLETE", "COMPLETE", "CNX", "COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE", "DELAY", "COMPLETE"],
        "flight_hours": np.random.uniform(1.0, 8.0, 14).round(1),
        "contraband_lbs": [1200, 0, 0, 5000, 0, 200, 0, 0, 800, 0, 300, 0, 0, 1500],
        "detainees": [3,0,0,12,0,1,0,0,2,0,1,0,0,4],
        "tois": [1,0,1,5,0,1,0,0,1,0,1,0,0,2],
        "deployment_id": ["DEP-001"] * 7 + ["DEP-002"] * 7,
        "notes": ["Standard patrol", "Nothing significant", "Engine temp high", "Big bust", "Weather delay", "", "", "Weather CNX", "", "", "", "", "Crew rest", ""],
        "responsible_part": ["N/A", "N/A", "Shield AI", "N/A", "Weather", "N/A", "N/A", "Weather", "N/A", "N/A", "N/A", "N/A", "Crew", "N/A"],
        "updated_by": ["System", "System", "Admin", "System", "MetOc", "System", "System", "MetOc", "System", "System", "System", "System", "Admin", "System"]
    })
    st.session_state['db_state']['flights'] = flights_data

    # 2. Equipment
    equip_data = pd.DataFrame({
        "id": range(1, 8),
        "serial_number": ["VBAT-001", "VBAT-002", "VBAT-003", "EO-901", "GCS-101", "VBAT-004", "VBAT-005"],
        "equipment": ["V-BAT 001", "V-BAT 002", "V-BAT 003", "EO Payload", "MaxVision GCS", "V-BAT 004", "V-BAT 005"],
        "category": ["Aircraft", "Aircraft", "Aircraft", "Payload", "GCS", "Aircraft", "Aircraft"],
        "status": ["FMC", "NMC", "PMC", "FMC", "FMC", "FMC", "CAT5"],
        "location": ["Hangar", "Deck", "Hangar", "Store", "Control Room", "Site B", "Lost at Sea"],
        "deployment_id": ["DEP-001", "DEP-001", "DEP-001", "DEP-001", "DEP-001", "DEP-002", "DEP-002"]
    })
    st.session_state['db_state']['equipment'] = equip_data
    
    # 3. Deployments
    dep_data = pd.DataFrame({
        "deployment_id": ["DEP-001", "DEP-002", "DEP-003"],
        "name": ["USCG Cutter James", "Land Base Alpha", "Forward Operating Base Charlie"],
        "type": ["Ship", "Land", "Land"],
        "status": ["Active", "Active", "Planning"],
        "start_date": [datetime.now(), datetime.now(), datetime.now() + timedelta(days=30)]
    })
    st.session_state['db_state']['deployments'] = dep_data
    
    # 4. Inventory
    inv_data = pd.DataFrame({
        "id": range(1, 40),
        "part_number": [f"PN-{i:03d}" for i in range(1, 40)],
        "description": [f"Component Type {i}" for i in range(1, 40)],
        "quantity_on_hand": np.random.randint(0, 50, 39),
        "min_quantity": [10] * 39,
        "category": ["Consumable", "Rotable"] * 19 + ["Consumable"],
        "deployment_id": ["DEP-001"] * 20 + ["DEP-002"] * 19
    })
    st.session_state['db_state']['inventory'] = inv_data
    
    # 5. Service Bulletins
    sb_data = pd.DataFrame({
        "id": [1, 2],
        "sb_number": ["SB-2025-001", "SB-2025-002"],
        "description": ["Propeller Assembly Inspection", "Firmware 2.0 Update"],
        "date_issued": [date(2025, 10, 1), date(2025, 11, 15)],
        # Mock compliance tracked as JSON-like structure in real app, here simplified cols
        "status_DEP-001": ["Complete", "Partial"], 
        "status_DEP-002": ["N/A", "Not Complete"]
    })
    st.session_state['db_state']['service_bulletins'] = sb_data

    # 6. Shipping
    st.session_state['db_state']['shipping'] = pd.DataFrame({
        "id": [1001, 1002, 1003],
        "tracking_number": ["TRK-987654321", "TRK-123456789", "TRK-456123789"],
        "carrier": ["FedEx", "DHL", "UPS"],
        "deployment_id": ["DEP-001", "DEP-001", "DEP-002"],
        "status": ["In Transit", "Received (Site)", "Ordered"],
        "order_date": [datetime.now() - timedelta(days=5), datetime.now() - timedelta(days=20), datetime.now() - timedelta(days=1)],
        "item_count": [12, 55, 3]
    })
    
    # 7. Shipment Items (Mock)
    st.session_state['db_state']['shipment_items'] = pd.DataFrame({
        "id": range(1, 4),
        "shipment_id": [1002, 1001, 1002],
        "part_number": ["PN-001", "PN-005", "PN-010"],
        "quantity": [10, 5, 20],
        "description": ["Gasket", "Screw", "Propeller"]
    })

    # 8. Kits (Mock)
    st.session_state['db_state']['kits'] = pd.DataFrame({
        "id": [1, 2],
        "kit_number": ["KIT-001", "KIT-002"],
        "kit_name": ["Maintenance Kit A", "Sensor cleaning kit"],
        "status": ["Complete", "Incomplete"],
        "deployment_id": ["DEP-001", "DEP-002"]
    })
    
    # 9. Parts Utilization (Mock)
    st.session_state['db_state']['parts_utilization'] = pd.DataFrame({
        "id": [1, 2, 3],
        "part_number": ["PN-005", "PN-020", "PN-100"],
        "description": ["Screw", "Bolt", "Lens Wipe"],
        "quantity_used": [2, 4, 1],
        "aircraft_id": ["VBAT-001", "VBAT-002", "VBAT-001"],
        "date_used": [date.today(), date.today(), date.today()],
        "deployment_id": ["DEP-001", "DEP-001", "DEP-001"]
    })

    # 10. Kit Items (Mock)
    st.session_state['db_state']['kit_items'] = pd.DataFrame({
        "id": range(1, 5),
        "kit_id": [1, 1, 2, 2],
        "part_number": ["PN-005", "PN-010", "PN-100", "PN-200"],
        "description": ["Screw", "Propeller", "Lens Wipe", "Sensor Module"],
        "quantity": [10, 1, 5, 1],
        "actual_quantity": [10, 1, 3, 1], # Kit 2 is incomplete
        "serial_number": ["N/A", "N/A", "N/A", "SN-999"],
        "category": ["Consumable", "Rotable", "Consumable", "Rotable"]
    })

    # 11. Parts Catalog (Mock)
    st.session_state['db_state']['parts_catalog'] = pd.DataFrame({
        "id": range(1, 6),
        "part_number": ["PN-001", "PN-002", "PN-003", "PN-005", "PN-010"],
        "description": ["Gasket", "Seal", "Filter", "Screw", "Propeller"],
        "category": ["Consumable", "Consumable", "Consumable", "Consumable", "Rotable"],
        "created_at": [date.today()] * 5
    })



# Run Init
load_data_initial()

# ==========================================
# VIEW FUNCTIONS
# ==========================================

def view_dashboard():
    st.title("Command Dashboard")
    st.markdown("Overview of operations, equipment status, and deployments.")

    flights_df = db.get_table('flights')
    equip_df = db.get_table('equipment')
    dep_df = db.get_table('deployments')
    
    # --- Filter ---
    # Global Dashboard Filter
    dep_options = ["All"] + list(dep_df['name'].unique()) if not dep_df.empty and 'name' in dep_df.columns else ["All"] + list(dep_df['deployment_id'].unique())
    sel_dep = st.selectbox("Filter by Deployment", dep_options)
    
    # Apply Filter to Data
    if sel_dep != "All":
        # Resolve Name back to ID if needed, or filter by Name if we merge. 
        # Simpler: Get valid IDs for name.
        if 'name' in dep_df.columns:
            valid_ids = dep_df[dep_df['name'] == sel_dep]['deployment_id'].tolist()
            flights_df = flights_df[flights_df['deployment_id'].isin(valid_ids)]
            equip_df = equip_df[equip_df['deployment_id'].isin(valid_ids)]
            # We don't filter dep_df itself usually so we can still show context, 
            # but for active count logic, we might want to? 
            # Actually user said "allow all metrics to be filtered".
            # "Active Deployments" metric might just become 1 or 0 if filtered?
            # Let's keep dep_df as lookups, but maybe filter 'active' count logic.
        else:
            flights_df = flights_df[flights_df['deployment_id'] == sel_dep]
            equip_df = equip_df[equip_df['deployment_id'] == sel_dep]
    
    # --- Top Stats ---
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">Total Flights</div>
            <div class="metric-value">{len(flights_df)}</div>
            <div class="metric-sub">Recorded missions</div>
        </div>
        """, unsafe_allow_html=True)
    with c2:
        hours = flights_df['flight_hours'].sum() if not flights_df.empty else 0
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">Flight Hours</div>
            <div class="metric-value">{hours:.1f}</div>
            <div class="metric-sub">Operational hours</div>
        </div>
        """, unsafe_allow_html=True)
    with c3:
        fmc = len(equip_df[equip_df['status'] == 'FMC'])
        total = len(equip_df)
        rate = (fmc / total * 100) if total > 0 else 0
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">Fleet Readiness</div>
            <div class="metric-value" style="color: {'#4CAF50' if rate > 80 else '#FFC107'}">{rate:.1f}%</div>
            <div class="metric-sub">{fmc}/{total} Assets FMC</div>
        </div>
        """, unsafe_allow_html=True)
    with c4:
        # If filtered, this just shows if selected is active. If All, shows count of active.
        if sel_dep == "All":
             active = len(dep_df[dep_df['status'] == 'Active'])
        else:
             # Check if selected is active
             # We need to look up status of selected.
             if 'name' in dep_df.columns:
                 active = len(dep_df[(dep_df['name'] == sel_dep) & (dep_df['status'] == 'Active')])
             else:
                 active = len(dep_df[(dep_df['deployment_id'] == sel_dep) & (dep_df['status'] == 'Active')])
                 
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">Active Deployments</div>
            <div class="metric-value">{active}</div>
            <div class="metric-sub">{'In Selection' if sel_dep != 'All' else 'Current Missions'}</div>
        </div>
        """, unsafe_allow_html=True)

    # --- Operational Findings ---
    st.subheader("Operational Findings")
    o1, o2, o3 = st.columns(3)
    
    tois = flights_df['tois'].sum() if 'tois' in flights_df else 0
    contraband = flights_df['contraband_lbs'].sum() if 'contraband_lbs' in flights_df else 0
    detainees = flights_df['detainees'].sum() if 'detainees' in flights_df else 0
    
    with o1:
        st.metric("TOIs Identified", int(tois))
    with o2:
        st.metric("Contraband Seized (lbs)", f"{contraband:,.0f}")
    with o3:
        st.metric("Detainees", int(detainees))
    
    # --- System Performance (New) -- Date Based Stacked ---
    st.divider()
    st.subheader("Mission Performance")
    
    if not flights_df.empty:
        # Prepare Data
        # We need Date, Name, Hours, Valid MRR/OFTR flags
        
        # Join Dep Name
        if 'name' in dep_df.columns:
             merged_df = flights_df.merge(dep_df[['deployment_id', 'name']], on='deployment_id', how='left')
        else:
             merged_df = flights_df.copy()
             merged_df['name'] = merged_df['deployment_id']
             
        # Aggregate for Stacked Bar (Group by Date + Deployment)
        # We want to stack by Deployment Name.
        daily_stack = merged_df.groupby(['date', 'name'])['flight_hours'].sum().reset_index()
        
        # Aggregate for Lines (Group by Date only, calculating weighted rate)
        # Group by Date
        daily_metrics = []
        for d in merged_df['date'].unique():
            day_df = merged_df[merged_df['date'] == d]
            
            n_complete = len(day_df[day_df['status'] == 'COMPLETE'])
            n_delayed = len(day_df[day_df['status'] == 'DELAY'])
            n_cnx_shield = len(day_df[(day_df['status'] == 'CNX') & (day_df['responsible_part'] == 'Shield AI')])
            
            denom_mrr = n_complete + n_delayed + n_cnx_shield
            mrr = ((n_complete + n_delayed) / denom_mrr) if denom_mrr > 0 else None # None to skip plotting point? Or 0?
            
            denom_oftr = n_complete + n_delayed
            oftr = (n_complete / denom_oftr) if denom_oftr > 0 else None
            
            daily_metrics.append({
                "date": d,
                "MRR": mrr,
                "OFTR": oftr
            })
        metrics_df = pd.DataFrame(daily_metrics).sort_values('date')
        
        # Build Chart
        fig = go.Figure()
        
        # 1. Stacked Bars (Iterate deployments)
        # Get list of deployments present in this filtered view
        present_deps = daily_stack['name'].unique()
        # Color map? Plotly handles auto colors but custom is nice.
        
        for dep in present_deps:
            dep_data = daily_stack[daily_stack['name'] == dep]
            fig.add_trace(go.Bar(
                x=dep_data['date'],
                y=dep_data['flight_hours'],
                name=str(dep),
                # marker_color... let auto-assign or map
            ))
            
        fig.update_layout(barmode='stack')
        
        # 2. Line - MRR (Right Y)
        fig.add_trace(go.Scatter(
            x=metrics_df['date'],
            y=metrics_df['MRR'],
            name='Daily MRR',
            mode='lines+markers',
            line=dict(color='#4CAF50', width=3),
            yaxis='y2',
            connectgaps=True # If some days have no flights
        ))
        
        # 3. Line - OFTR (Right Y)
        fig.add_trace(go.Scatter(
            x=metrics_df['date'],
            y=metrics_df['OFTR'],
            name='Daily OFTR',
            mode='lines+markers',
            line=dict(color='#FFC107', width=3, dash='dot'),
            yaxis='y2',
            connectgaps=True
        ))
        
        # Layout
        fig.update_layout(
            title="Daily Flight Hours & Reliability (Stacked by Deployment)",
            template="plotly_dark",
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            xaxis=dict(title="Date"),
            yaxis=dict(
                title="Flight Hours",
                gridcolor='#333'
            ),
            yaxis2=dict(
                title="Rate",
                overlaying='y',
                side='right',
                tickformat='.0%',
                range=[0, 1.1],
                gridcolor='#333'
            ),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        
        st.plotly_chart(fig, width="stretch", use_container_width=True)
    else:
        st.info("No flight data available to calculate performance metrics.")



    # --- Charts ---
    st.divider()
    g1, g2 = st.columns([2, 1])
    
    with g1:
        st.markdown("### Flight Activity")
        if not flights_df.empty:
            daily = flights_df.groupby("date")["flight_hours"].sum().reset_index()
            fig_bar = px.bar(daily, x="date", y="flight_hours", title="Daily Flight Hours", template="plotly_dark")
            fig_bar.update_layout(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig_bar, width="stretch")
        else:
            st.info("No flight data available.")
        
    with g2:
        st.markdown("### Equipment Status")
        if not equip_df.empty:
            status_counts = equip_df['status'].value_counts()
            fig_pie = px.pie(names=status_counts.index, values=status_counts.values, hole=0.4, template="plotly_dark",
                             color=status_counts.index, 
                             color_discrete_map={'FMC':'#4CAF50', 'NMC':'#F44336', 'PMC':'#FFC107', 'CAT5':'#9E9E9E'})
            fig_pie.update_layout(paper_bgcolor="rgba(0,0,0,0)")
            st.plotly_chart(fig_pie, width="stretch")
        else:
            st.info("No equipment data available.")


def view_flights():
    st.title("Flight Operations")
    df = db.get_table('flights')
    deps_df = db.get_table('deployments')
    
    # Map: ID -> "ID: Name"
    # Used for display to provide context while keeping ID uniqueness
    dep_map = {
        row['deployment_id']: f"{row['deployment_id']}: {row['name']}"
        for _, row in deps_df.iterrows()
    }
    all_deps = deps_df['deployment_id'].unique().tolist()
    
    # Filters moved to Main Data Table section

    # 2. Actions (Add / Import)
    
    # Dynamic Add Flight Form (Full Width)
    
    # Session State for Form
    if "add_flight_open" not in st.session_state:
        st.session_state["add_flight_open"] = False
    
    # Toggle Button
    btn_txt = "➕ Add New Flight Log" if not st.session_state["add_flight_open"] else "➖ Cancel / Close Form"
    if st.button(btn_txt, width="stretch", key="add_flight_toggle"):
        st.session_state["add_flight_open"] = not st.session_state["add_flight_open"]
        st.rerun()

    if st.session_state["add_flight_open"]:
        with st.container(border=True):
            st.markdown("### New Flight Entry")
            
            # Flattened Reasons Map for Reverse Lookup
            REASON_MAP = {}
            ALL_REASONS = []
            for party, reasons in CANCELLATION_REASONS.items():
                for r in reasons:
                    REASON_MAP[r] = party
                    ALL_REASONS.append(r)
            ALL_REASONS = sorted(list(set(ALL_REASONS)))

            # Helper for Auto-Calc
            def calc_flight_hours():
                start = st.session_state.get("new_f_launch")
                end = st.session_state.get("new_f_land")
                if start and end:
                    t1 = timedelta(hours=start.hour, minutes=start.minute)
                    t2 = timedelta(hours=end.hour, minutes=end.minute)
                    if t2 < t1: t2 += timedelta(days=1)
                    diff = (t2 - t1).total_seconds() / 3600
                    st.session_state["new_f_hours"] = round(max(0.0, diff), 1)
            
            # Helper for Auto-Mission Number
            def get_next_mission_id(date_obj, ac_num, status):
                # Format: M-YYYYMMDD-AC-SEQ
                # If Alert: M-YYYYMMDD-ALERT-SEQ
                
                date_str = date_obj.strftime("%Y%m%d")
                
                # 1. Determine Middle Segment
                if status == "ALERT - NO LAUNCH":
                    mid_seg = "ALERT"
                else:
                    # Extract Suffix (e.g. VBAT-001 -> 001)
                    mid_seg = ac_num.split("-")[-1] if ac_num and "-" in ac_num else "XXX"
                
                # 2. Count existing for this day to determine SEQ
                # We filter by Date AND 'M-{date_str}' prefix to be safe
                existing_df = db.get_table('flights')
                
                # Robust Date Compare
                mask = pd.to_datetime(existing_df['date']).dt.date == date_obj
                daily_count = len(existing_df[mask])
                
                # Seq is count + 1 (Simple logic, race conditions ignored for mock)
                seq = daily_count + 1
                
                return f"M-{date_str}-{mid_seg}-{seq:02d}"

            # Initialize manual override key if not present
            if "new_f_hours" not in st.session_state:
                st.session_state["new_f_hours"] = 0.0

            # Row 1: Core Identifiers
            r1c1, r1c2, r1c3, r1c4 = st.columns(4)
            
            f_date = r1c1.date_input("Date *", key="new_f_date")
            f_status = r1c2.selectbox("Status *", ["COMPLETE", "DELAY", "CNX", "ABORTED", "ALERT - NO LAUNCH"], key="new_f_status")
            
            # Logic for Field States
            is_cnx = f_status == "CNX"
            is_aborted = f_status == "ABORTED"
            is_delay = f_status == "DELAY"
            is_complete = f_status == "COMPLETE"
            is_alert = f_status == "ALERT - NO LAUNCH"
            
            # Labels
            lbl_dep = "Deployment *"
            
            # Aircraft: Required for DELAY/COMPLETE. Optional for ABORTED. Disabled/NA for CNX/ALERT.
            lbl_ac = "Aircraft *" if (is_delay or is_complete) else "Aircraft"
            
            # Payload: Required for DELAY/COMPLETE. Optional for ABORTED. Disabled/NA for CNX/ALERT.
            lbl_pay = "Payload 1 *" if (is_delay or is_complete) else "Payload 1"
            
            # Times: Required for DELAY/COMPLETE. Optional for ABORTED. Disabled/NA for CNX/ALERT.
            lbl_launch = "Launch Time *" if (is_delay or is_complete) else "Launch Time"
            lbl_land = "Land Time *" if (is_delay or is_complete) else "Land Time"
            
            # Reason: Required for CNX/DELAY. Optional for ABORTED? User said "all others are optional".
            lbl_reason = "Reason Code *" if (is_cnx or is_delay) else "Reason Code"
            
            f_dep_id = r1c4.selectbox(
                lbl_dep, 
                all_deps, 
                key="new_f_dep",
                format_func=lambda x: dep_map.get(x, x)
            )

            st.divider()
            
            # Row 2: Operational Data
            
            r2c1, r2c2, r2c3, r2c4 = st.columns(4)
            
            # Disabled for CNX or ALERT. Enabled (but optional) for ABORTED.
            op_disabled = is_cnx or is_alert
            
            f_aircraft = r2c1.selectbox(lbl_ac, ["VBAT-001", "VBAT-002", "VBAT-003"], disabled=op_disabled, key="new_f_ac")
            
            # Now we can calc mission num
            auto_mission_num = get_next_mission_id(f_date, f_aircraft, f_status)
            
            # Display Read-Only Mission Num
            r1c3.text_input("Mission # (Auto)", value=auto_mission_num, disabled=True, key="new_f_mission_disp")
            
            f_payload = r2c2.text_input(lbl_pay, disabled=op_disabled, key="new_f_pay1")
            
            # Times
            f_sched = r2c3.time_input("Scheduled Launch", value=None, disabled=op_disabled, step=60, key="new_f_sched")
            
            r3c1, r3c2, r3c3 = st.columns(3)
            f_launch = r3c1.time_input(lbl_launch, value=None, disabled=op_disabled, step=60, key="new_f_launch", on_change=calc_flight_hours)
            f_land = r3c2.time_input(lbl_land, value=None, disabled=op_disabled, step=60, key="new_f_land", on_change=calc_flight_hours)
            
            f_hours = r3c3.number_input("Flight Hours", min_value=0.0, step=0.1, disabled=op_disabled, key="new_f_hours")

            # Row 3.5: Mission Results
            # User: "tois, contraband and detainees are required fields for complete, or delayed flights."
            is_result_req = is_complete or is_delay
            
            lbl_tois = "TOIs *" if is_result_req else "TOIs"
            lbl_lbs = "Contraband (lbs) *" if is_result_req else "Contraband (lbs)"
            lbl_det = "Detainees *" if is_result_req else "Detainees"
            
            r_res1, r_res2, r_res3 = st.columns(3)
            
            # Using number_input ensures we get a number or None
            f_tois = r_res1.number_input(lbl_tois, min_value=0, step=1, disabled=op_disabled, key="new_f_tois")
            f_contraband = r_res2.number_input(lbl_lbs, min_value=0.0, step=0.1, disabled=op_disabled, key="new_f_lbs")
            f_detainees = r_res3.number_input(lbl_det, min_value=0, step=1, disabled=op_disabled, key="new_f_det")

            st.markdown("#### Deviation / Details")
            
            r4c1, r4c2 = st.columns(2)
            
            # Deviation Block - Disabled if ALERT? 
            dev_disabled = is_alert
            
            # Reverse Lookup Logic
            # 1. Select Reason from ALL reasons
            f_reason = r4c1.selectbox(lbl_reason, [""] + ALL_REASONS, disabled=dev_disabled, key="new_f_reason")
            
            # 2. Derive Responsible Party
            calc_resp_part = "N/A"
            if f_reason and f_reason in REASON_MAP:
                calc_resp_part = REASON_MAP[f_reason]
                
            # Display Calculated Party (Disabled/Read-only)
            r4c2.text_input("Responsible Party", value=calc_resp_part, disabled=True)
            
            f_notes = st.text_area("Notes", height=100, key="new_f_notes")

            if st.button("Save Flight Log", type="primary"):
                errors = []
                # Mission is auto-generated, so always exists.
                
                if is_alert:
                    pass 
                elif is_aborted:
                    pass # User: "all others are optional"
                elif is_cnx:
                    if not f_reason: errors.append("Reason Code is required for Cancellations.")
                elif is_delay:
                    if not f_reason: errors.append("Reason Code is required for Delays.")
                    if not f_launch or not f_land: errors.append("Launch and Land times are required.")
                    if not f_payload: errors.append("Payload 1 is required.")
                    # Results Required? User: "required... for complete, or delayed"
                    # Note: number_input with default 0.0 is technically "filled".
                    # If we want to force user to look at it, we might want None default, but st.number_input value defaults to min_value if not None.
                    # Here we assume 0 is a valid input for these. "Required" usually means "don't leave as None" or "Dont omit".
                    # With `min_value=0` and default, it's always 0+.
                    pass 
                elif is_complete:
                    if not f_launch or not f_land: errors.append("Launch and Land times are required.")
                    if not f_payload: errors.append("Payload 1 is required.")
                
                # Explicit Validation for Results if required
                # Since number_input defaults to 0, it's hard to be "missing". 
                # But the user said "ensure 'None' or N/A are input... avoid null inputs".
                # This implies we just need to ensure we SAVE a non-null value.
                
                if errors:
                    for e in errors: st.error(e)
                else:
                    # Default Logic: "avoid null inputs"
                    # Logic: f_val if f_val is not None else 0
                    
                    final_tois = f_tois if f_tois is not None else 0
                    final_contra = f_contraband if f_contraband is not None else 0.0
                    final_det = f_detainees if f_detainees is not None else 0
                    
                    new_record = {
                        "date": f_date,
                        "mission_number": auto_mission_num, # Use Auto Value
                        "aircraft_number": f_aircraft if (not is_cnx and not is_alert) else "N/A",
                        "flight_hours": f_hours if (not is_cnx and not is_alert) else 0.0,
                        "status": f_status,
                        "responsible_part": calc_resp_part,
                        "reason_for_delay": f_reason,
                        "deployment_id": f_dep_id,
                        "notes": f_notes,
                        "payload_1": f_payload if (not is_cnx and not is_alert) else "",
                        "launch_time": f_launch.strftime("%H:%M") if f_launch else "",
                        "recovery_time": f_land.strftime("%H:%M") if f_land else "",
                        
                        # Result Fields
                        "tois": final_tois if is_result_req else 0,
                        "contraband_lbs": final_contra if is_result_req else 0.0,
                        "detainees": final_det if is_result_req else 0,
                        
                        "created_at": datetime.now().isoformat(),
                        "updated_by": "Admin"
                    }
                    db.add_record('flights', new_record)
                    
                    # Cleanup & Feedback
                    st.session_state["add_flight_open"] = False
                    
                    # Clear Form Keys
                    keys_to_clear = [
                        "new_f_mission", "new_f_notes", "new_f_reason", "new_f_pay1", 
                        "new_f_launch", "new_f_land", "new_f_hours",
                        "new_f_tois", "new_f_lbs", "new_f_det"
                    ]
                    for k in keys_to_clear:
                        if k in st.session_state: del st.session_state[k]
                    
                    st.success(f"Flight {auto_mission_num} Saved Successfully!")
                    st.rerun()

    # Import Section (Expander)
    with st.expander("📥 Import Flights (Excel/CSV)"):
        up_file = st.file_uploader("Upload File", type=['xlsx', 'csv'])
        if up_file:
            try:
                raw_df = pd.read_excel(up_file)
                valid_records, errors = validate_flight_import(raw_df)
                
                if errors:
                    st.error(f"Found {len(errors)} errors.")
                    st.dataframe(pd.DataFrame({"Errors": errors}))
                
                if valid_records:
                    st.success(f"Validated {len(valid_records)} records.")
                    if st.button("Confirm Import"):
                        count = 0
                        for r in valid_records:
                            # Auto-assign first selected deployment if missing
                            if 'deployment_id' not in r or not r['deployment_id']:
                                r['deployment_id'] = sel_deps[0] if sel_deps else "Unknown"
                            db.add_record('flights', r)
                            count += 1
                        st.toast(f"Imported {count} flights successfully!")
                        st.rerun()
            except Exception as e:
                st.error(f"File Parse Error: {e}")

    # 3. Main Data Table
    
    # --- FILTERS ---
    flt_c1, flt_c2, flt_c3 = st.columns([2, 1, 2])
    
    with flt_c1:
        # Deployment: Multiselect
        sel_deps = st.multiselect(
            "Deployments", 
            all_deps, 
            default=[],
            format_func=lambda x: dep_map.get(x, x)
        )
        
    with flt_c2:
        # Status: Multiselect
        all_stats = ["COMPLETE", "CNX", "DELAY", "ABORTED", "ALERT - NO LAUNCH"]
        sel_stat = st.multiselect("Status", all_stats, default=[])
        
    with flt_c3:
        # Date: Range
        d_c1, d_c2 = st.columns(2)
        start_d = d_c1.date_input("Start", value=date(2025, 1, 1))
        end_d = d_c2.date_input("End", value=date(2025, 12, 31))
        
    # Apply Logic
    filtered = df.copy()
    if sel_deps:
        filtered = filtered[filtered['deployment_id'].isin(sel_deps)]
    if sel_stat:
        filtered = filtered[filtered['status'].str.upper().isin(sel_stat)]
    if start_d:
        filtered = filtered[filtered['date'] >= start_d]
    if end_d:
        filtered = filtered[filtered['date'] <= end_d]
        
    st.divider()
    # ----------------
    
    # Toggle Edit Mode
    c_lock, c_title = st.columns([1, 5])
    is_unlocked = c_lock.checkbox("🔓 Unlock Table", key="flights_unlock", help="Enable inline editing")
    
    if is_unlocked:
        # EDITABLE VIEW
        st.info("📝 Editing Mode Active. Changes are saved automatically.")
        
        # Prepare Data for Editor: Swap ID for Description
        editor_df = filtered.copy()
        
        # Create Composite Column for Editor
        editor_df['deployment_select'] = editor_df['deployment_id'].map(dep_map)
        
        # Reorder columns: Deployment first, remove Mission Number
        cols = ['deployment_select', 'date', 'aircraft_number', 'status', 'responsible_part', 'reason_for_delay', 'contraband_lbs', 'flight_hours', 'id', 'deployment_id', 'updated_by']
        editor_df = editor_df[cols]

        edited_df = st.data_editor(
            editor_df,
            width="stretch",
            height=600,
            key="flights_editor",
            column_config={
                "id": None, # Hide ID
                "deployment_id": None, # Hide Raw ID (we use Select)
                "date": st.column_config.DateColumn("Date", format="YYYY-MM-DD", required=True),
                # "mission_number": Drop,
                "aircraft_number": st.column_config.SelectboxColumn("Aircraft", options=["VBAT-001", "VBAT-002", "VBAT-003"]),
                "status": st.column_config.SelectboxColumn("Status", options=["COMPLETE", "CNX", "DELAY", "ABORTED"]),
                "responsible_part": st.column_config.SelectboxColumn("Resp. Part", options=list(CANCELLATION_REASONS.keys()) + ["N/A"]),
                "updated_by": st.column_config.TextColumn("Last Edit", disabled=True),
                "deployment_select": st.column_config.SelectboxColumn("Deployment", options=list(dep_map.values()), required=True),
                "reason_for_delay": st.column_config.TextColumn("Reason Code"),
                "contraband_lbs": st.column_config.NumberColumn("Contraband", format="%.0f"),
                "flight_hours": st.column_config.NumberColumn("Hours", format="%.1f"),
            },
            # Disable changing the Raw ID (even if hidden, good practice)
            disabled=["created_at", "updated_by", "deployment_id"], 
            hide_index=True
        )
        
        # Update Logic
        if not edited_df.equals(editor_df):
            current_full_df = db.get_table('flights')
            updates_count = 0
            
            # We assume ID matches
            for index, row in edited_df.iterrows():
                row_id = row.get('id')
                if row_id is not None:
                    mask = current_full_df['id'] == row_id
                    if mask.any():
                        old_row = current_full_df.loc[mask].iloc[0]
                        has_change = False
                        
                        # 1. Reverse Map Deployment if Changed
                        new_dep_str = row.get('deployment_select')
                        new_dep_id = None
                        if new_dep_str:
                             # Extract ID from "ID: Name"
                             # Assuming format "ID: Name"
                             new_dep_id = new_dep_str.split(":")[0]
                        
                        # Check Standard Cols
                        for col in ['date', 'mission_number', 'aircraft_number', 'status', 'responsible_part', 'reason_for_delay', 'contraband_lbs', 'flight_hours', 'notes']:
                             if row.get(col) != old_row.get(col):
                                 has_change = True
                                 current_full_df.loc[mask, col] = row.get(col)
                        
                        # Check Deployment Change
                        if new_dep_id and new_dep_id != old_row.get('deployment_id'):
                            has_change = True
                            current_full_df.loc[mask, 'deployment_id'] = new_dep_id
                            
                        if has_change:
                            current_full_df.loc[mask, 'updated_by'] = "Admin" # Mock
                            updates_count += 1
            
            if updates_count > 0:
                st.session_state['db_state']['flights'] = current_full_df
                st.toast(f"Saved {updates_count} changes.")
                st.rerun()

    else:
        # READ-ONLY STYLED VIEW
        # Insert Mapped Column for Display
        display_df = filtered.copy()
        display_df['Deployment'] = display_df['deployment_id'].map(dep_map)
        
        # Drop ID cols and Mission Number
        display_df = display_df.drop(columns=['id', 'deployment_id', 'mission_number'], errors='ignore')

        # Reorder: Deployment First
        cols = ['Deployment'] + [c for c in display_df.columns if c != 'Deployment']
        display_df = display_df[cols]
        
        # Style Logic
        def style_responsible(val):
            # Soft Highlighting: Blue Grey Text + Soft Bg
            if isinstance(val, str) and val.lower() == 'shield ai':
                return 'color: #455A64; font-weight: bold; background-color: #ECEFF1;'
            return ''

        styled_df = display_df.style.map(style_responsible, subset=['responsible_part'])

        st.dataframe(
            styled_df,
            width="stretch",
            height=600,
            column_config={
                "date": st.column_config.DateColumn("Date", format="YYYY-MM-DD"),
                "Deployment": st.column_config.TextColumn("Deployment"),
                # "mission_number": Removed
                "status": st.column_config.TextColumn("Status"),
                "responsible_part": st.column_config.TextColumn("Resp. Part"),
                "updated_by": st.column_config.TextColumn("Updated By"),
                "contraband_lbs": st.column_config.NumberColumn("Contraband", format="%.0f"),
                "flight_hours": st.column_config.NumberColumn("Hours", format="%.1f"),
            }
        )

def view_equipment():
    st.title("Equipment Management")
    
    # 1. Fetch Data
    eq_df = db.get_table('equipment')
    dep_df = db.get_table('deployments')
    
    # Map Deployment ID -> Name
    if not dep_df.empty and 'name' in dep_df.columns:
        dep_map = dict(zip(dep_df['deployment_id'], dep_df['name']))
    else:
        dep_map = {}

    # 2. Controls
    c_ctrl, c_legend = st.columns([1, 4])
    is_edit_mode = c_ctrl.toggle("Enable Editing", key="equip_edit_mode")
    
    if not is_edit_mode:
        with c_legend:
            st.caption("Status Legend: 🟢 FMC (Fully Mission Capable) | 🟡 PMC (Partial) | 🔴 NMC (Non-Mission) | ⚫ CAT5 (Out of Service)")
    
    # 3. Iterate Deployments
    # Use generic "Unassigned" if ID not found? Assuming all valid.
    unique_deps = eq_df['deployment_id'].unique()
    
    # Add new deployment handling? User said "allow addition of new rows for each deployment". 
    # If a deployment has NO equipment, it won't show up in unique_deps. 
    # We should iterate through ALL Active Deployments instead.
    active_deps = dep_df['deployment_id'].unique() if not dep_df.empty else unique_deps
    
    for dep_id in active_deps:
        dep_name = dep_map.get(dep_id, "Unknown Deployment")
        header_text = f"{dep_id} - {dep_name}"
        
        with st.expander(header_text, expanded=True):
            # Filter Data
            subset = eq_df[eq_df['deployment_id'] == dep_id].copy()
            
            if is_edit_mode:
                # --- EDIT MODE ---
                # Allow adding rows. To add a row to *this* deployment, we need to handle the new row having the correct deployment_id.
                # data_editor 'num_rows="dynamic"' adds empty rows. We'd have to post-process to fill deployment_id?
                # Or just let them save and fill it in?
                # Better: Use a dedicated "Add" block or just trust user to fill?
                # Actually, if we hide deployment_id col, user can't fill it.
                # Strategy: We show all cols (except ID). User adds row. We inject dep_id on save.
                
                edited_subset = st.data_editor(
                    subset,
                    key=f"editor_{dep_id}",
                    num_rows="dynamic",
                    width="stretch",
                    column_config={
                        "status": st.column_config.SelectboxColumn("Status", options=["FMC", "PMC", "NMC", "CAT5"], required=True),
                        "equipment": st.column_config.TextColumn("Equipment Name", required=True),
                        "serial_number": st.column_config.TextColumn("Serial #", required=True),
                        "category": st.column_config.SelectboxColumn("Category", options=["Aircraft", "GCS", "Payload", "Comms"]),
                        "location": st.column_config.TextColumn("Location"),
                        "comments": st.column_config.TextColumn("Comments"),
                    },
                    hide_index=True,
                    disabled=["id", "deployment_id"] # Don't let them touch ID wiring
                )
                
                # Save Logic
                # If changes detected
                if not edited_subset.equals(subset):
                    # 1. Identify New Rows (missing 'deployment_id' or 'id' if we strictly rely on that)
                    # Actually, filtered subset has valid IDs. New rows from editor usually have NaN or 0 defaults depending on schema?
                    # Streamlit creates new rows with default values (None/NaN).
                    
                    # We need to grab the Full DB, remove old rows for this Dep, and insert the New Subset (with fixes)
                    
                    # Fix New Rows: Fill missing Deployment ID
                    # Check for rows where deployment_id is NaN/None (newly added)
                    # Note: subset came from filtered eq_df. New rows won't have the fixed value unless we set default?
                    # We can't set hidden default easily. We just fillna.
                    
                    edited_subset['deployment_id'] = dep_id
                    
                    # 3. Merge Back
                    full_df = db.get_table('equipment')
                    # Drop old for this dep
                    remaining = full_df[full_df['deployment_id'] != dep_id]
                    
                    # Assign new IDs to new rows if needed? 
                    # If 'id' is empty/NaN, generate one.
                    if 'id' in edited_subset.columns:
                        # Simple valid max ID logic
                        max_id = full_df['id'].max() if not full_df.empty else 0
                        # Identify new rows (NaN id)
                        # This depends on how st.data_editor handles numerical ID cols on new rows. Usually None.
                        # We iterate and fix.
                         # Vectorized fix difficult with increment. Loop ok for small data.
                        for i, row in edited_subset.iterrows():
                             if pd.isna(row['id']) or row['id'] == 0:
                                 max_id += 1
                                 edited_subset.at[i, 'id'] = max_id
                    
                    new_full = pd.concat([remaining, edited_subset], ignore_index=True)
                    st.session_state['db_state']['equipment'] = new_full
                    st.toast(f"Saved changes for {dep_id}")
                    # Rerun to refresh view
                    # st.rerun() # Be careful of loops. Toast is enough feedback usually, but rerun ensures IDs stick.
            
            else:
                # --- READ ONLY (Styled) ---
                # Apply Styling
                def style_status(row):
                    s = row['status']
                    styles = [''] * len(row)
                    
                    # Base colors
                    bg_color = ''
                    txt_color = ''
                    
                    if s == 'FMC':
                        bg_color = '#4CAF50' # Green
                        txt_color = 'white'
                    elif s == 'PMC':
                        bg_color = '#FFC107' # Yellow
                        txt_color = 'black'
                    elif s == 'NMC':
                        bg_color = '#F44336' # Red
                        txt_color = 'white'
                    elif s == 'CAT5':
                        # Grey out entire row
                        return ['background-color: #9E9E9E; color: #EEEEEE; opacity: 0.6'] * len(row)
                    
                    # Apply specific cell color to 'status' column only? 
                    # User said "color code the status block". 
                    # "CAT5 (grey - entire row greyed out)"
                    
                    # Create style list
                    new_styles = []
                    for col in row.index:
                        if col == 'status' and bg_color:
                            new_styles.append(f'background-color: {bg_color}; color: {txt_color}; font-weight: bold; border-radius: 4px;')
                        else:
                            new_styles.append('')
                    return new_styles

                # Apply
                if not subset.empty:
                    # Styling dataframe needs to act on the Styler object
                    # We can use 'apply' row-wise
                    styled = subset.style.apply(style_status, axis=1)
                    
                    st.dataframe(
                        styled,
                        width="stretch",
                        column_config={
                             "id": None, 
                             "deployment_id": None,
                             "status": st.column_config.TextColumn("Status"),
                             "equipment": st.column_config.TextColumn("Equipment"),
                             "serial_number": st.column_config.TextColumn("Serial #"),
                             "category": st.column_config.TextColumn("Category"),
                             "location": st.column_config.TextColumn("Location"),
                             "comments": st.column_config.TextColumn("Comments")
                        },
                        hide_index=True
                    )
                else:
                    st.info("No equipment assigned.")


def view_inventory():
    st.title("Master Inventory")
    
    deps_df = db.get_table('deployments')
    dep_names = deps_df.set_index("deployment_id")["name"].to_dict()
    
    selected_dep = st.selectbox("Select Deployment", deps_df['deployment_id'].unique(), format_func=lambda x: f"{x} - {dep_names.get(x, '')}")
    
    inv_df = db.get_table('inventory')
    shipping_df = db.get_table('shipping') # Fixed access
    
    # Shipment Queue
    incoming = shipping_df[(shipping_df['deployment_id'] == selected_dep) & (shipping_df['status'] != 'Received (Site)')]
    if not incoming.empty:
        st.warning(f"🚚 {len(incoming)} Shipments In-Transit/Ordered")
        with st.expander("Incoming Shipments Queue"):
            st.dataframe(incoming, width="stretch")
            if st.button("Simulate Receiving All"):
                # Mock Logic
                shipping_df.loc[shipping_df['deployment_id'] == selected_dep, 'status'] = 'Received (Site)'
                st.toast("Shipments Marked Received - Inventory Counts Updated (Simulation)")
                st.rerun()

    # Main Inventory
    dep_inv = inv_df[inv_df['deployment_id'] == selected_dep]
    
    st.markdown("### Stock Level Control")
    
    edited_inv = st.data_editor(
        dep_inv,
        key=f"inv_editor_{selected_dep}",
        width="stretch",
        column_config={
            "quantity_on_hand": st.column_config.NumberColumn("On Hand", min_value=0, step=1, format="%d"),
            "min_quantity": st.column_config.NumberColumn("Min Qty", min_value=0, step=1),
            "description": st.column_config.TextColumn("Description"),
        },
        disabled=["id", "part_number", "category", "deployment_id"],
        hide_index=True
    )
    
    # Save Logic (similar to Equipment)
    if not edited_inv.equals(dep_inv):
         current_full = db.get_table('inventory')
         other_rows = current_full[current_full['deployment_id'] != selected_dep]
         updated_full = pd.concat([other_rows, edited_inv], ignore_index=True)
         st.session_state['db_state']['inventory'] = updated_full
         st.toast("Inventory Updated")
         st.rerun()

def view_kits():
    st.title("Kits Management")
    kits_df = db.get_table('kits') # Currently empty in MockDB init, let's fix that or handle empty
    
    if kits_df.empty:
        # Just for demo until MockDB is fully populated with kits
        kits_df = pd.DataFrame({
            "id": [1, 2],
            "kit_name": ["Standard Loadout A", "Spare Parts Kit B"],
            "kit_number": ["KIT-001", "KIT-002"],
            "version": ["1.0", "1.1"],
            "deployment_id": ["DEP-001", "DEP-001"],
            "item_count": [45, 120]
        })
        st.session_state['db_state']['kits'] = kits_df

    deployments = kits_df['deployment_id'].unique()
    
    for dep in deployments:
        st.markdown(f"### {dep}")
        dep_kits = kits_df[kits_df['deployment_id'] == dep]
        
        for _, kit in dep_kits.iterrows():
            with st.expander(f"📦 {kit['kit_name']} (SN: {kit.get('kit_number', 'N/A')})"):
                c1, c2 = st.columns([1, 4])
                with c1:
                    # st.markdown(f"**Items:** {kit['item_count']}") # Removed item_count if not in schema
                    if st.button("Edit Kit Details", key=f"edit_kit_{kit['id']}"):
                        st.session_state[f"editing_kit_{kit['id']}"] = True
                
                with c2:
                    st.info("Kit items would be listed here (Part #, Serial #).")
                    
                # Upload logic for specific kit updates could go here
                
    st.divider()
    st.divider()
    with st.expander("Import New Kit Definition"):
        st.info("Upload a Kit Excel file to add it to a deployment.")
        
        # Deployment Selector
        dep_df = db.get_table('deployments')
        
        # Create Map for ID -> Name
        dep_map = {}
        if not dep_df.empty and 'name' in dep_df.columns:
            dep_map = dict(zip(dep_df['deployment_id'], dep_df['name']))
        
        valid_deps = dep_df['deployment_id'].unique() if not dep_df.empty else []
        
        c_imp1, c_imp2 = st.columns(2)
        target_dep = c_imp1.selectbox(
            "Assign to Deployment", 
            valid_deps, 
            format_func=lambda x: f"{x} - {dep_map.get(x, '')}",
            key="kit_import_dep"
        )
        
        uploaded_file = c_imp2.file_uploader("Upload Kit Excel", type=['xlsx', 'xls'], key="kit_upload")
        
        if uploaded_file and target_dep:
            if st.button("Process Import"):
                try:
                    # Mock Logic: We just create a dummy kit entry based on filename
                    # In real app: df = pd.read_excel(uploaded_file)
                    
                    new_kit = {
                        "id": len(kits_df) + 1,
                        "kit_name": uploaded_file.name.split('.')[0],
                        "kit_number": f"KIT-{len(kits_df) + 1:03d}",
                        "version": "1.0",
                        "deployment_id": target_dep,
                        "item_count": 0 # Would be len(df)
                    }
                    
                    st.session_state['db_state']['kits'] = pd.concat([kits_df, pd.DataFrame([new_kit])], ignore_index=True)
                    st.toast(f"Imported {new_kit['kit_name']} to {target_dep}")
                    st.rerun()
                    
                except Exception as e:
                    st.error(f"Import Failed: {e}")
def view_shipping():
    st.title("Shipping & Logistics")
    
    # Init State
    if 'shipping_view_mode' not in st.session_state:
        st.session_state['shipping_view_mode'] = 'list' # list, edit
    if 'editing_shipment_uid' not in st.session_state:
        st.session_state['editing_shipment_uid'] = None
        
    df = db.get_table('shipping')
    
    # --- ACTIONS ---
    def handle_save_shipment(uid, deploy_id, carrier, track, ord_date, items_df):
        # Update Main DF
        # This is a mock update. In real app we'd merge or append.
        # For simplicity, if UID exists, update. Else append.
        
        # 1. Update/Add Header
        new_row = {
            "id": uid, # Using 'id' internal integer
            "deployment_id": deploy_id,
            "carrier": carrier,
            "tracking_number": track,
            "order_date": pd.to_datetime(ord_date),
            "status": "Ordered", # Simplification
            "item_count": len(items_df) if items_df is not None else 0
        }
        
        # Mock Insert/Update
        existing_idx = df.index[df['id'] == uid].tolist()
        if existing_idx:
            for col, val in new_row.items():
                st.session_state['db_state']['shipping'].at[existing_idx[0], col] = val
        else:
             st.session_state['db_state']['shipping'] = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
             
        # 2. Update Items (MockDB doesn't have a separate shipment_items table yet, so we just track count)
        # In V4 we'd save the items_df to a 'shipment_items' table.
        
        st.toast(f"Shipment {uid} Saved!")
        st.session_state['shipping_view_mode'] = 'list'
        st.rerun()

    # --- VIEWS ---
    if st.session_state['shipping_view_mode'] == 'list':
        col1, col2 = st.columns([4, 1])
        col1.markdown("Manage incoming and outgoing logistics.")
        if col2.button("➕ New Shipment", type="primary"):
            st.session_state['editing_shipment_uid'] = None
            st.session_state['shipping_view_mode'] = 'edit'
            st.rerun()
            
        st.dataframe(
            df, 
            width="stretch",
            column_config={
                "order_date": st.column_config.DateColumn("Date"),
                "id": st.column_config.NumberColumn("ID", format="%d"),
                "tracking_number": st.column_config.TextColumn("Tracking #"),
                "status": st.column_config.TextColumn("Status"),
            }
        )
        
        # Quick Edit (Mock)
        # Quick Edit (Mock)
        # Select using tracking number for display, but logic uses ID? 
        # For simplicity in mock, select ID.
        try:
            sel_uid = st.selectbox("Select Shipment to Edit", df['id'].unique(), index=None, placeholder="Choose shipment ID...", format_func=lambda x: f"ID {x}")
        except KeyError:
             st.error("Data Error: 'id' column missing in Shipping table.")
             sel_uid = None
        if sel_uid:
            if st.button(f"Edit {sel_uid}"):
                st.session_state['editing_shipment_uid'] = sel_uid
                st.session_state['shipping_view_mode'] = 'edit'
                st.rerun()

    elif st.session_state['shipping_view_mode'] == 'edit':
        uid_target = st.session_state['editing_shipment_uid']
        is_new = uid_target is None
        
        st.subheader(f"{'New' if is_new else 'Edit'} Shipment")
        
        # Pre-fill
        # Pre-fill
        record = df[df['id'] == uid_target].iloc[0] if not is_new and not df[df['id'] == uid_target].empty else {}
        
        # Header Inputs (No Form Wrapper to allow "Add Line" interactivity)
        c1, c2 = st.columns(2)
        # Use Number Input for ID since schema is Integer
        s_uid = c1.number_input("Shipment ID", value=record.get('id', int(datetime.now().strftime('%y%m%d01'))), step=1, format="%d")
        
        # Deployment Combo (ID + Name)
        dep_df = db.get_table('deployments')
        dep_map = dict(zip(dep_df['deployment_id'], dep_df['name']))
        s_dep = c2.selectbox("Deployment", dep_df['deployment_id'].unique(), format_func=lambda x: f"{x} - {dep_map.get(x, '')}")
        
        c3, c4 = st.columns(2)
        s_carrier = c3.text_input("Carrier", value=record.get('carrier', ''))
        s_track = c4.text_input("Tracking #", value=record.get('tracking_number', ''))
        
        s_date = st.date_input("Order Date", value=record.get('order_date', datetime.now()))
        
        st.divider()
        st.markdown("#### Manifest Items")
        
        # Smart Add Item
        st.markdown("Add Item to Manifest")
        c_add1, c_add2, c_add3, c_add4 = st.columns([3, 2, 1, 1])
        
        # Suggest from Catalog
        catalog_df = db.get_table('parts_catalog')
        
        # Create content for selectbox
        # Format: "PN | Desc"
        part_map = {}
        if not catalog_df.empty:
            for _, row in catalog_df.iterrows():
                label = f"{row['part_number']} | {row['description']}"
                part_map[label] = row
        
        part_options = list(part_map.keys())
        
        # State for Smart Add - Initialize widget keys directly if needed
        if 'input_pn' not in st.session_state: st.session_state['input_pn'] = ""
        if 'input_desc' not in st.session_state: st.session_state['input_desc'] = ""
        if 'input_qty' not in st.session_state: st.session_state['input_qty'] = 1
        
        # Selectbox for lookup
        # If user selects something, we auto-fill and disable text inputs for PN/Desc
        sel_part_label = c_add1.selectbox("Lookup Part (Select or leave empty for new)", [""] + part_options, key="lookup_part_selectbox")
        
        is_catalog_item = False
        if sel_part_label and sel_part_label != "":
            is_catalog_item = True
            row_data = part_map[sel_part_label]
            # Force update session state for widgets to reflect the change immediately
            st.session_state['input_pn'] = row_data['part_number']
            st.session_state['input_desc'] = row_data['description']
        
        # Inputs
        # If catalog item selected, disable editing core fields to ensure consistency
        # REMOVED value=... kwarg to avoid warning. State is managed via key.
        new_pn = c_add1.text_input("Part Number", key="input_pn", disabled=is_catalog_item)
        new_desc = c_add2.text_input("Description", key="input_desc", disabled=is_catalog_item)
        new_qty = c_add3.number_input("Qty", min_value=1, key="input_qty")
        
        # Temporary Manifest Storage
        if 'temp_manifest' not in st.session_state:
            st.session_state['temp_manifest'] = []

        # Button to Add
        if c_add4.button("Add Line", type="secondary"):
            # If catalog item, we trust values. If not, we take inputs.
            # However, if disabled, st.session_state.input_pn might not carry the value? 
            # Streamlit quirk: disabled inputs don't always submit value if relying on state.
            # We use local vars `new_pn` / `new_desc` which capture the return of text_input.
            
            final_pn = new_pn
            final_desc = new_desc
            
            if final_pn:
                # 1. Add to Manifest List
                st.session_state['temp_manifest'].append({
                    "part_number": final_pn,
                    "description": final_desc,
                    "quantity": new_qty
                })
                
                # 2. Check/Add to Parts Catalog (Only if NOT catalog item)
                if not is_catalog_item:
                        existing_part = catalog_df[catalog_df['part_number'] == final_pn]
                        if existing_part.empty:
                            new_part_id = len(catalog_df) + 1
                            new_part_entry = {
                                "id": new_part_id,
                                "part_number": final_pn,
                                "description": final_desc,
                                "category": "Uncategorized",
                                "created_at": date.today()
                            }
                            st.session_state['db_state']['parts_catalog'] = pd.concat([catalog_df, pd.DataFrame([new_part_entry])], ignore_index=True)
                            st.toast(f"New Part Created: {final_pn}")
                
                # Reset manual inputs
                st.session_state['smart_add_pn'] = ""
                st.session_state['smart_add_desc'] = ""
                st.session_state['smart_add_qty'] = 1
                st.rerun()
            else:
                st.error("Part Number is required.")

        # Display Manifest
        manifest_df = pd.DataFrame(st.session_state['temp_manifest'])
        if not manifest_df.empty:
            st.dataframe(manifest_df, width="stretch")
        
        st.divider()
        if st.button("Save Shipment", type="primary"):
            final_items_df = pd.DataFrame(st.session_state['temp_manifest'])
            handle_save_shipment(s_uid, s_dep, s_carrier, s_track, s_date, final_items_df)
            
            # Clear Temp
            st.session_state['temp_manifest'] = []
        
        if st.button("Cancel"):
            st.session_state['shipping_view_mode'] = 'list'
            st.rerun()


def view_service_bulletins():
    st.title("Service Bulletins")
    
    sbs = db.get_table('service_bulletins')
    deps = db.get_table('deployments')
    active_deps = deps[deps['status'] != 'Archived']
    
    st.markdown("### Compliance Matrix")
    
    # Simulated Pivot View
    cols = st.columns([1, 1, 3] + [1] * len(active_deps))
    cols[0].markdown("**Date**")
    cols[1].markdown("**SB #**")
    cols[2].markdown("**Description**")
    for i, row in active_deps.iterrows():
        cols[3+i].markdown(f"**{row['name']}**") # Use Name or ID
        
    st.divider()
    
    for _, sb in sbs.iterrows():
        r_cols = st.columns([1, 1, 3] + [1] * len(active_deps))
        r_cols[0].write(sb['date_issued'])
        r_cols[1].write(sb['sb_number'])
        r_cols[2].write(sb['description'])
        
        # Deployment Columns
        for i, dep_row in active_deps.iterrows():
            dep_id = dep_row['deployment_id']
            # Lookup status (mock logic: expects 'status_DEP-XXX' column)
            # In real app, this would be a lookup in 'effected_equipment' JSON or joined table
            status_col = f"status_{dep_id}"
            status = sb.get(status_col, "N/A")
            
            badge_class = "badge-nmc" # Default/Partial
            if status == "Complete": badge_class = "badge-fmc"
            if status == "N/A": badge_class = "badge-pmc"
            
            # Clean display
            r_cols[3+i].markdown(f"<span class='{badge_class}'>{status}</span>", unsafe_allow_html=True)

    st.markdown("---")
    if st.checkbox("Toggle Admin Mode"):
        st.info("Admin mode allows creating new Service Bulletins. (Feature Placeholder)")

# ==========================================
# ROUTER
# ==========================================

# 1. State Management for Navigation
if 'page' not in st.session_state:
    st.session_state['page'] = "Dashboard"

# 2. Sidebar Menu
pages = {
    "Dashboard": "📊 Dashboard",
    "Flights": "✈️ Flights",
    "Equipment": "🚁 Equipment",
    "Inventory": "📦 Master Inventory",
    "Kits": "🛠️ Kits",
    "Deployments": "🚤 Deployments",
    "Shipping": "🚢 Shipping",
    "Service Bulletins": "📋 Service Bulletins",
    "Reports": "📑 Reports"
}

st.sidebar.title("Navigation")

for page_key, page_label in pages.items():
    # Highlight active page
    is_active = (st.session_state['page'] == page_key)
    if st.sidebar.button(
        page_label, 
        key=f"nav_{page_key}", 
        width="stretch", 
        type="primary" if is_active else "secondary"
    ):
        st.session_state['page'] = page_key
        st.rerun()

current_page = st.session_state['page']

st.sidebar.markdown("---")
st.sidebar.caption(f"User: Matt Davis (Admin)")
st.sidebar.caption(f"Env: Foundry / Streamlit V3")

if current_page == "Dashboard":
    view_dashboard()
elif current_page == "Flights":
    view_flights()
elif current_page == "Equipment":
    view_equipment()
elif current_page == "Inventory":
    view_inventory()
elif current_page == "Kits":
    view_kits()
elif current_page == "Shipping":
    view_shipping()
elif current_page == "Service Bulletins":
    view_service_bulletins()
elif current_page == "Deployments":
    st.title("Deployments Management")
    st.info("📝 Manage deployments below. Use the '+' toolbar to add new deployments.")
    
    dep_df = db.get_table('deployments')
    
    edited_dep_df = st.data_editor(
        dep_df,
        key="deployments_editor",
        num_rows="dynamic",
        width="stretch",
        column_config={
            "deployment_id": st.column_config.TextColumn("Deployment ID", required=True, help="Unique Identifier (e.g. DEP-001)"),
            "name": st.column_config.TextColumn("Description", required=True),
            "status": st.column_config.SelectboxColumn("Status", options=["Active", "Planned", "Archived", "Complete"], required=True),
            "start_date": st.column_config.DateColumn("Start Date"),
            "end_date": st.column_config.DateColumn("End Date"),
            "location": st.column_config.TextColumn("Location"),
        }
    )
    
    # Save Logic
    if not edited_dep_df.equals(dep_df):
        st.session_state['db_state']['deployments'] = edited_dep_df
        st.toast("✅ Deployments updated successfully!")
else:
    st.title(current_page)
    st.warning("Module under active development.")

