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
    page_title="S.P.A.R.K. | Readiness System",
    page_icon="✈️",
    layout="wide",
    initial_sidebar_state="expanded"
)

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
    "service_bulletins": "ri.foundry.main.dataset.sb-mock-rid"
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
            st.session_state['shipping'] = backend.read_dataset("shipping")
            
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
        "deployment_id": ["DEP-001"] * 7 + ["DEP-002"] * 7,
        "notes": ["Standard patrol", "Nothing significant", "Engine temp high", "Big bust", "Weather delay", "", "", "Weather CNX", "", "", "", "", "Crew rest", ""],
        "responsible_part": ["N/A", "N/A", "Avionics", "N/A", "Weather", "N/A", "N/A", "Weather", "N/A", "N/A", "N/A", "N/A", "Crew", "N/A"],
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
    st.session_state['shipping'] = pd.DataFrame({
        "uid": ["SHP-1001", "SHP-1002", "SHP-1003"],
        "deployment_id": ["DEP-001", "DEP-001", "DEP-002"],
        "status": ["In Transit", "Received (Site)", "Ordered"],
        "order_date": [datetime.now() - timedelta(days=5), datetime.now() - timedelta(days=20), datetime.now() - timedelta(days=1)],
        "item_count": [12, 55, 3]
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
        active = len(dep_df[dep_df['status'] == 'Active'])
        st.markdown(f"""
        <div class="metric-card">
            <div class="metric-label">Active Deployments</div>
            <div class="metric-value">{active}</div>
            <div class="metric-sub">Current Missions</div>
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
    
    # 1. Filters (Parity with Flights.jsx)
    with st.sidebar:
        st.subheader("Filters")
        
        # Deployment Filter
        all_deps = deps_df['deployment_id'].unique().tolist()
        sel_deps = st.multiselect(
            "Deployments", 
            all_deps, 
            default=all_deps,
            format_func=lambda x: dep_map.get(x, x) # Show Name, Return ID
        )
        
        # Status Filter
        all_stats = ["COMPLETE", "CNX", "DELAY", "ABORTED"]
        sel_stat = st.multiselect("Status", all_stats, default=all_stats)
        
        # Date Filter
        d_col1, d_col2 = st.columns(2)
        start_d = d_col1.date_input("Start Date", value=date(2025, 1, 1))
        end_d = d_col2.date_input("End Date", value=date(2025, 12, 31))

    # Apply Filters
    filtered = df.copy()
    if sel_deps:
        filtered = filtered[filtered['deployment_id'].isin(sel_deps)]
    if sel_stat:
        # Case insensitive match
        filtered = filtered[filtered['status'].str.upper().isin(sel_stat)]
    if start_d:
        filtered = filtered[filtered['date'] >= start_d]
    if end_d:
        filtered = filtered[filtered['date'] <= end_d]

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
                sel_deps, 
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
    
    # Toggle Edit Mode
    c_lock, c_title = st.columns([1, 5])
    is_unlocked = c_lock.checkbox("🔓 Unlock Table", key="flights_unlock", help="Enable inline editing")
    
    if is_unlocked:
        # EDITABLE VIEW
        st.info("📝 Editing Mode Active. Changes are saved automatically.")
        
        # Prepare Data for Editor: Swap ID for Description
        editor_df = filtered.copy()
        
        # Create Composite Column for Editor
        # We will allow editing this dropdown, which means we need to handle the save back to ID
        editor_df['deployment_select'] = editor_df['deployment_id'].map(dep_map)
        
        # To avoid confusion, we Hide 'deployment_id' and show 'deployment_select'
        
        edited_df = st.data_editor(
            editor_df,
            width="stretch",
            height=600,
            key="flights_editor",
            column_config={
                "id": None, # Hide ID
                "deployment_id": None, # Hide Raw ID (we use Select)
                "date": st.column_config.DateColumn("Date", format="YYYY-MM-DD", required=True),
                "mission_number": st.column_config.TextColumn("Mission", required=True),
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
        
        # Drop ID cols from Display
        # Keep 'id' in a separate var if we needed it for selection, but st.dataframe selection returns index.
        # We should reset_index to ensure 0-based index matches selection if we filtered? 
        # WARNING: filtered is a slice. reset_index is crucial for correct selection mapping!
        display_df = display_df.reset_index(drop=True)
        
        # Style Logic
        def style_responsible(val):
            if isinstance(val, str) and val.lower() == 'shield ai':
                return 'color: #F44336; font-weight: bold;'
            return ''

        # Apply Style
        styled_df = display_df.style.map(style_responsible, subset=['responsible_part'])

        event = st.dataframe(
            styled_df,
            width="stretch",
            height=600,
            on_select="rerun",
            selection_mode="single-row",
            column_config={
                "id": None, # Hide ID from view
                "deployment_id": None, # Hide Raw ID
                "date": st.column_config.DateColumn("Date", format="YYYY-MM-DD"),
                "Deployment": st.column_config.TextColumn("Deployment"),
                "mission_number": st.column_config.TextColumn("Mission", help="Mission ID"),
                "status": st.column_config.TextColumn("Status"),
                "responsible_part": st.column_config.TextColumn("Resp. Part"),
                "updated_by": st.column_config.TextColumn("Updated By"),
                "contraband_lbs": st.column_config.NumberColumn("Contraband", format="%.0f"),
                "flight_hours": st.column_config.NumberColumn("Hours", format="%.1f"),
            }
        )
        
        # Detail View
        if len(event.selection.rows) > 0:
            idx = event.selection.rows[0]
            # Get data from the RESET index dataframe
            selected_row = display_df.iloc[idx]
            
            st.markdown("### 📋 Flight Details")
            
            # Formatted Display
            d1, d2 = st.columns(2)
            with d1:
                st.markdown(f"**Mission:** {selected_row['mission_number']}")
                st.markdown(f"**Date:** {selected_row['date']}")
                st.markdown(f"**Deployment:** {selected_row['Deployment']}")
                st.markdown(f"**Status:** {selected_row['status']}")
                st.markdown(f"**Aircraft:** {selected_row['aircraft_number']}")
                
            with d2:
                st.markdown(f"**Resp. Party:** {selected_row['responsible_part']}")
                st.markdown(f"**Reason:** {selected_row['reason_for_delay']}")
                st.markdown(f"**Launch:** {selected_row['launch_time']} | **Land:** {selected_row['recovery_time']}")
                st.markdown(f"**Hours:** {selected_row['flight_hours']}")
                st.markdown(f"**Payload:** {selected_row['payload_1']}")

            st.markdown("---")
            
            # Results & Notes
            d3, d4 = st.columns(2)
            with d3:
                st.markdown("**Mission Results:**")
                st.markdown(f"- **TOIs:** {selected_row.get('tois', 0)}")
                st.markdown(f"- **Contraband:** {selected_row.get('contraband_lbs', 0)} lbs")
                st.markdown(f"- **Detainees:** {selected_row.get('detainees', 0)}")
            
            with d4:
                 st.markdown("**Notes:**")
                 st.info(selected_row['notes'] if selected_row['notes'] else "No notes.")

def view_equipment():
    st.title("Equipment Management")
    df = db.get_table('equipment')
    deployments = df['deployment_id'].unique()
    
    st.info("💡 Edit status directly in the table below. Changes persist for this session.")
    
    for dep in deployments:
        with st.expander(f"Deployment: {dep}", expanded=True):
            dep_eq = df[df['deployment_id'] == dep]
            
            # Helper for color
            def highlight_status(s):
                if s == 'FMC': return 'background-color: rgba(76, 175, 80, 0.2); color: #4CAF50'
                if s == 'NMC': return 'background-color: rgba(244, 67, 54, 0.2); color: #F44336'
                if s == 'PMC': return 'background-color: rgba(255, 193, 7, 0.2); color: #FFC107'
                return ''

           # Editable Dataframe
            edited_df = st.data_editor(
                dep_eq,
                width="stretch",
                key=f"editor_{dep}",
                column_config={
                    "status": st.column_config.SelectboxColumn(
                        "Status",
                        options=["FMC", "NMC", "PMC", "CAT5"],
                        required=True
                    ),
                    "location": st.column_config.TextColumn("Location"),
                    "comments": st.column_config.TextColumn("Comments")
                },
                disabled=["id", "serial_number", "equipment", "category", "deployment_id"],
                hide_index=True
            )
            
            # Check for changes (Comparing manually or trusting session state update logic if we hooked it)
            # Streamlit data_editor returns the new state. We need to update MockDB if changed.
            if not edited_df.equals(dep_eq):
                # Find diffs
                # For simplicity in this mock, we just replace the rows in the main DB for this deployment
                # In real app, we'd iterate and update specific IDs
                
                # Broad Update Strategy:
                # 1. Drop old rows for this dep
                current_full = db.get_table('equipment')
                other_rows = current_full[current_full['deployment_id'] != dep]
                # 2. Concat
                updated_full = pd.concat([other_rows, edited_df], ignore_index=True)
                st.session_state['db_state']['equipment'] = updated_full
                st.toast(f"Updated Equipment for {dep}")


def view_inventory():
    st.title("Master Inventory")
    
    deps_df = db.get_table('deployments')
    dep_names = deps_df.set_index("deployment_id")["name"].to_dict()
    
    selected_dep = st.selectbox("Select Deployment", deps_df['deployment_id'].unique(), format_func=lambda x: f"{x} - {dep_names.get(x, '')}")
    
    inv_df = db.get_table('inventory')
    shipping_df = st.session_state['shipping'] # Not in mock_db class yet, generic session
    
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
            with st.expander(f"📦 {kit['kit_name']} (v{kit['version']})"):
                c1, c2 = st.columns([1, 4])
                with c1:
                    st.markdown(f"**Items:** {kit['item_count']}")
                    if st.button("Edit Kit Details", key=f"edit_kit_{kit['id']}"):
                        st.session_state[f"editing_kit_{kit['id']}"] = True
                
                with c2:
                    st.info("Kit items would be listed here (Part #, Serial #).")
                    
                # Upload logic for specific kit updates could go here
                
    st.divider()
    with st.expander("Import New Kit Definition"):
        st.file_uploader("Upload Kit Excel", key="kit_upload")

    st.divider()
    with st.expander("Import New Kit Definition"):
        st.file_uploader("Upload Kit Excel", key="kit_upload")

def view_shipping():
    st.title("Shipping & Logistics")
    
    # Init State
    if 'shipping_view_mode' not in st.session_state:
        st.session_state['shipping_view_mode'] = 'list' # list, edit
    if 'editing_shipment_uid' not in st.session_state:
        st.session_state['editing_shipment_uid'] = None
        
    df = st.session_state['shipping']
    
    # --- ACTIONS ---
    def handle_save_shipment(uid, deploy_id, carrier, track, ord_date, items_df):
        # Update Main DF
        # This is a mock update. In real app we'd merge or append.
        # For simplicity, if UID exists, update. Else append.
        
        # 1. Update/Add Header
        new_row = {
            "uid": uid,
            "deployment_id": deploy_id,
            "carrier": carrier,
            "tracking_number": track,
            "order_date": ord_date,
            "status": "Ordered", # Simplification
            "item_count": len(items_df) if items_df is not None else 0
        }
        
        # Mock Insert/Update
        existing_idx = df.index[df['uid'] == uid].tolist()
        if existing_idx:
            for col, val in new_row.items():
                st.session_state['shipping'].at[existing_idx[0], col] = val
        else:
             st.session_state['shipping'] = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
             
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
            use_container_width=True,
            column_config={
                "order_date": st.column_config.DateColumn("Date"),
                "uid": st.column_config.TextColumn("Reference"),
                "status": st.column_config.TextColumn("Status"),
            }
        )
        
        # Quick Edit (Mock)
        sel_uid = st.selectbox("Select Shipment to Edit", df['uid'].unique(), index=None, placeholder="Choose shipment...")
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
        record = df[df['uid'] == uid_target].iloc[0] if not is_new and not df[df['uid'] == uid_target].empty else {}
        
        with st.form("shipment_form"):
            c1, c2 = st.columns(2)
            s_uid = c1.text_input("UID / Reference", value=record.get('uid', f"SHIP-{datetime.now().strftime('%y%m%d')}-001"))
            s_dep = c2.selectbox("Deployment", db.get_table('deployments')['deployment_id'].unique())
            
            c3, c4 = st.columns(2)
            s_carrier = c3.text_input("Carrier", value=record.get('carrier', ''))
            s_track = c4.text_input("Tracking #", value=record.get('tracking_number', ''))
            
            s_date = st.date_input("Order Date", value=record.get('order_date', datetime.now()))
            
            st.markdown("#### Manifest Items")
            # Mock Item Editor
            # We create a dummy DF for the editor
            dummy_items = pd.DataFrame([{"part": "", "qty": 1, "desc": ""} for _ in range(5)])
            edited_items = st.data_editor(dummy_items, num_rows="dynamic", width="stretch")
            
            if st.form_submit_button("Save Shipment"):
                handle_save_shipment(s_uid, s_dep, s_carrier, s_track, s_date, edited_items)
        
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
    st.title("Deployments")
    st.dataframe(db.get_table('deployments'))
else:
    st.title(current_page)
    st.warning("Module under active development.")

