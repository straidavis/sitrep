import pandas as pd
from transforms.api import transform, Input, Output
from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType, DateType

# ==========================================
# SCHEMA DEFINITIONS (Reference for Column Names)
# ==========================================

FLIGHT_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("date", DateType(), True),
    StructField("mission_number", StringType(), True),
    StructField("aircraft_number", StringType(), True),
    StructField("status", StringType(), True),
    StructField("scheduled_launch", StringType(), True),
    StructField("launch_time", StringType(), True),
    StructField("recovery_time", StringType(), True),
    StructField("flight_hours", DoubleType(), True),
    StructField("payload_1", StringType(), True),
    StructField("payload_2", StringType(), True),
    StructField("payload_3", StringType(), True),
    StructField("winds", StringType(), True),
    StructField("reason_for_delay", StringType(), True),
    StructField("reason_for_cancel", StringType(), True),
    StructField("tois", IntegerType(), True),
    StructField("notes", StringType(), True),
    StructField("created_at", StringType(), True),
    StructField("launcher", StringType(), True),
    StructField("number_of_launches", IntegerType(), True),
    StructField("contraband_lbs", DoubleType(), True),
    StructField("detainees", IntegerType(), True),
    StructField("responsible_part", StringType(), True),
    StructField("deployment_id", StringType(), True),
    StructField("updated_by", StringType(), True)
])

EQUIPMENT_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("log_date", DateType(), True),
    StructField("serial_number", StringType(), True),
    StructField("equipment_type", StringType(), True),
    StructField("category", StringType(), True),
    StructField("status", StringType(), True),
    StructField("location", StringType(), True),
    StructField("software_version", StringType(), True),
    StructField("comments", StringType(), True),
    StructField("last_updated", DateType(), True),
    StructField("deployment_id", StringType(), True)
])

DEPLOYMENT_SCHEMA = StructType([
    StructField("deployment_id", StringType(), False),
    StructField("name", StringType(), True),
    StructField("location", StringType(), True),
    StructField("start_date", DateType(), True),
    StructField("end_date", DateType(), True),
    StructField("status", StringType(), True),
    StructField("type", StringType(), True),
    StructField("notes", StringType(), True),
    StructField("user_emails", StringType(), True)
])

SHIPPING_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("tracking_number", StringType(), True),
    StructField("carrier", StringType(), True),
    StructField("order_date", DateType(), True),
    StructField("ship_date", DateType(), True),
    StructField("host_received_date", DateType(), True),
    StructField("site_received_date", DateType(), True),
    StructField("status", StringType(), True),
    StructField("items", StringType(), True),
    StructField("shipped_date", DateType(), True),
    StructField("created_at", DateType(), True),
    StructField("notes", StringType(), True),
    StructField("deployment_id", StringType(), True)
])

PARTS_UTILIZATION_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("part_number", StringType(), True),
    StructField("serial_number", StringType(), True),
    StructField("description", StringType(), True),
    StructField("quantity_used", IntegerType(), True),
    StructField("aircraft_id", StringType(), True),
    StructField("date_used", DateType(), True),
    StructField("reason_for_replacement", StringType(), True),
    StructField("notes", StringType(), True),
    StructField("deployment_id", StringType(), True)
])

INVENTORY_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("part_number", StringType(), True),
    StructField("serial_number", StringType(), True),
    StructField("description", StringType(), True),
    StructField("category", StringType(), True),
    StructField("quantity_on_hand", IntegerType(), True),
    StructField("min_quantity", IntegerType(), True),
    StructField("expiration_date", DateType(), True),
    StructField("last_counted", DateType(), True),
    StructField("measured_unit", StringType(), True),
    StructField("notes", StringType(), True),
    StructField("deployment_id", StringType(), True)
])

KITS_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("kit_name", StringType(), True),
    StructField("kit_number", StringType(), True),
    StructField("components", StringType(), True),
    StructField("status", StringType(), True),
    StructField("location", StringType(), True),
    StructField("assigned_to", StringType(), True),
    StructField("last_inspected", DateType(), True),
    StructField("notes", StringType(), True),
    StructField("deployment_id", StringType(), True)
])

SERVICE_BULLETIN_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("sb_number", StringType(), True),
    StructField("date_issued", DateType(), True),
    StructField("description", StringType(), True),
    StructField("link", StringType(), True),
    StructField("notes", StringType(), True),
    StructField("applicable_deployment_ids", StringType(), True), # JSON string or comma-sep
    StructField("effected_equipment", StringType(), True), # JSON string of equipment IDs with compliance
    StructField("created_at", StringType(), True),
    StructField("last_updated_by", StringType(), True)
])

SHIPMENT_ITEMS_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("shipment_id", IntegerType(), True),
    StructField("part_number", StringType(), True),
    StructField("description", StringType(), True),
    StructField("quantity", IntegerType(), True),
    StructField("received_date", DateType(), True),
    StructField("notes", StringType(), True)
])

KIT_ITEMS_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("kit_id", IntegerType(), True),
    StructField("part_number", StringType(), True),
    StructField("description", StringType(), True),
    StructField("quantity", IntegerType(), True),
    StructField("actual_quantity", IntegerType(), True),
    StructField("serial_number", StringType(), True),
    StructField("category", StringType(), True),
    StructField("last_updated_by", StringType(), True)
])

PARTS_CATALOG_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("part_number", StringType(), True),
    StructField("description", StringType(), True),
    StructField("category", StringType(), True),
    StructField("created_at", DateType(), True)
])

# ==========================================
# CONFIGURATION
# ==========================================
# 1. RAW INPUTS (Using RIDs provided)
RAW_FLIGHTS_PATH = "ri.foundry.main.dataset.8c2b1cb4-b9a7-47ac-91e5-f4fd20d6b603"
RAW_EQUIPMENT_PATH = "ri.foundry.main.dataset.6fe48ad7-c0c9-45a6-b1fa-f398ea5b83a5"
RAW_DEPLOYMENTS_PATH = "ri.foundry.main.dataset.73cbe733-dd1f-427e-907d-d147483fc4bc"
RAW_SHIPPING_PATH = "ri.foundry.main.dataset.89309691-6ecf-4281-a0b4-256bb33979bf"
RAW_PARTS_UTILIZATION_PATH = "ri.foundry.main.dataset.1d21f9e4-c99e-444d-b1cc-8785ea0b3222"
RAW_INVENTORY_PATH = "ri.foundry.main.dataset.0237456f-b4d2-4fc2-b105-d4908e97a815"
RAW_KITS_PATH = "ri.foundry.main.dataset.c32685a4-e09c-4f8f-be88-425122caea7f"
RAW_SERVICE_BULLETINS_PATH = "ri.foundry.main.dataset.sb-mock-rid"
RAW_SHIPMENT_ITEMS_PATH = "ri.foundry.main.dataset.shipment-items-mock-rid"
RAW_KIT_ITEMS_PATH = "ri.foundry.main.dataset.kit-items-mock-rid"
RAW_PARTS_CATALOG_PATH = "ri.foundry.main.dataset.parts-catalog-mock-rid"

# 2. INTERMEDIATE OUTPUTS
CLEAN_FLIGHTS_PATH = "/Shield AI-6bcac2/SPARK/src/Clean/flights_clean"
CLEAN_EQUIPMENT_PATH = "/Shield AI-6bcac2/SPARK/src/Clean/equipment_clean"
CLEAN_DEPLOYMENTS_PATH = "/Shield AI-6bcac2/SPARK/src/Clean/deployments_clean"
CLEAN_SHIPPING_PATH = "/Shield AI-6bcac2/SPARK/src/Clean/shipping_clean"
CLEAN_PARTS_UTILIZATION_PATH = "/Shield AI-6bcac2/SPARK/src/Clean/parts_utilization_clean"
CLEAN_INVENTORY_PATH = "/Shield AI-6bcac2/SPARK/src/Clean/inventory_clean"
CLEAN_KITS_PATH = "/Shield AI-6bcac2/SPARK/src/Clean/kits_clean"
CLEAN_SERVICE_BULLETINS_PATH = "/Shield AI-6bcac2/SPARK/src/Clean/service_bulletins_clean"
CLEAN_SHIPMENT_ITEMS_PATH = "/Shield AI-6bcac2/SPARK/src/Clean/shipment_items_clean"
CLEAN_KIT_ITEMS_PATH = "/Shield AI-6bcac2/SPARK/src/Clean/kit_items_clean"
CLEAN_PARTS_CATALOG_PATH = "/Shield AI-6bcac2/SPARK/src/Clean/parts_catalog_clean"

# 3. FINAL ONTOLOGY OBJECT
ONTOLOGY_FLIGHT_PATH = "/Shield AI-6bcac2/SPARK/src/Ontology/FlightEvent"

# ==========================================
# PIPELINE LOGIC (Pandas Implementation for Lightweight Env)
# ==========================================

def robust_select(pdf, schema):
    """
    Enforces the schema on a Pandas DataFrame.
    Adds missing columns as None and selects fields in order.
    """
    column_names = [field.name for field in schema.fields]
    for col in column_names:
        if col not in pdf.columns:
            pdf[col] = None
    return pdf[column_names]

@transform.using(
    source_df=Input(RAW_FLIGHTS_PATH),
    output=Output(CLEAN_FLIGHTS_PATH)
)
def clean_flights(ctx, source_df, output):
    pdf = source_df.dataframe()
    
    # 1. Renames (Standardize input headers to matching snake_case schema field)
    rename_map = {
        "Date": "date",
        "Mission #": "mission_number",
        "Aircraft #": "aircraft_number",
        "Hours": "flight_hours",
        "Status": "status",
        "Payload 1": "payload_1",
        "Payload 2": "payload_2",
        "Payload 3": "payload_3",
        "Winds": "winds",
        "REASON for Cancel, Abort or Delay": "reason_for_cancel", # Mapping to primary reason field
        "TOIs": "tois",
        "Notes": "notes",
        "Deployment ID": "deployment_id"
    }
    pdf = pdf.rename(columns=rename_map)
    
    # 2. Validation & Types
    if "mission_number" in pdf.columns:
        pdf = pdf[pdf["mission_number"].notna()]
    if "date" in pdf.columns:
        pdf["date"] = pd.to_datetime(pdf["date"], errors='coerce').dt.date
        pdf = pdf[pdf["date"].notna()]
        
    if "flight_hours" in pdf.columns:
        pdf["flight_hours"] = pd.to_numeric(pdf["flight_hours"], errors='coerce')
    if "status" in pdf.columns:
        pdf["status"] = pdf["status"].str.upper()

    # 3. Add ID
    pdf["id"] = range(1, 1 + len(pdf))
    
    # 4. Enforce Schema
    output.write_pandas(robust_select(pdf, FLIGHT_SCHEMA))

@transform.using(
    source_df=Input(RAW_EQUIPMENT_PATH),
    output=Output(CLEAN_EQUIPMENT_PATH)
)
def clean_equipment(ctx, source_df, output):
    pdf = source_df.dataframe()
    
    # 1. Renames
    rename_map = {
        "Serial Number": "serial_number",
        "Category": "category",
        "Status": "status",
        "Software": "software_version",
        "Deployment ID": "deployment_id",
        "Location": "location",
        "Comments": "comments"
    }
    pdf = pdf.rename(columns=rename_map)
    
    # 2. Derived Columns
    if "status" in pdf.columns:
        def get_flag(s):
            if s == "FMC": return "GREEN"
            elif s == "NMC": return "RED"
            else: return "YELLOW"
        pdf["status_flag"] = pdf["status"].apply(get_flag)
        
    if "Date" in pdf.columns:
        pdf["log_date"] = pd.to_datetime(pdf["Date"], errors='coerce').dt.date
    else:
        pdf["log_date"] = None

    pdf["id"] = range(1, 1 + len(pdf))
    
    # 3. Validation
    if "serial_number" in pdf.columns:
        pdf = pdf[pdf["serial_number"].notna()]

    output.write_pandas(robust_select(pdf, EQUIPMENT_SCHEMA))

@transform.using(
    source_df=Input(RAW_DEPLOYMENTS_PATH),
    output=Output(CLEAN_DEPLOYMENTS_PATH)
)
def clean_deployments(ctx, source_df, output):
    pdf = source_df.dataframe()
    
    # 1. Renames
    rename_map = {
        "Deployment ID": "deployment_id",
        "Name": "name",
        "Start Date": "start_date",
        "End Date": "end_date",
        "Type": "type"
    }
    pdf = pdf.rename(columns=rename_map)
    
    # 2. Types
    if "start_date" in pdf.columns:
        pdf["start_date"] = pd.to_datetime(pdf["start_date"], errors='coerce').dt.date
    if "end_date" in pdf.columns:
        pdf["end_date"] = pd.to_datetime(pdf["end_date"], errors='coerce').dt.date
        
    # 3. Validation
    if "deployment_id" in pdf.columns:
        pdf = pdf[pdf["deployment_id"].notna()]
    if "start_date" in pdf.columns:
        pdf = pdf[pdf["start_date"].notna()]
        
    output.write_pandas(robust_select(pdf, DEPLOYMENT_SCHEMA))

@transform.using(
    source_df=Input(RAW_SHIPPING_PATH),
    output=Output(CLEAN_SHIPPING_PATH)
)
def clean_shipping(ctx, source_df, output):
    pdf = source_df.dataframe()
    pdf["id"] = range(1, 1 + len(pdf))
    
    if "tracking_number" in pdf.columns:
        pdf = pdf[pdf["tracking_number"].notna()]
        
    output.write_pandas(robust_select(pdf, SHIPPING_SCHEMA))

@transform.using(
    source_df=Input(RAW_PARTS_UTILIZATION_PATH),
    output=Output(CLEAN_PARTS_UTILIZATION_PATH)
)
def clean_parts_utilization(ctx, source_df, output):
    pdf = source_df.dataframe()
    pdf["id"] = range(1, 1 + len(pdf))
    
    if "part_number" in pdf.columns:
        pdf = pdf[pdf["part_number"].notna()]
        
    output.write_pandas(robust_select(pdf, PARTS_UTILIZATION_SCHEMA))

@transform.using(
    source_df=Input(RAW_INVENTORY_PATH),
    output=Output(CLEAN_INVENTORY_PATH)
)
def clean_inventory(ctx, source_df, output):
    pdf = source_df.dataframe()
    pdf["id"] = range(1, 1 + len(pdf))
    
    if "part_number" in pdf.columns:
        pdf = pdf[pdf["part_number"].notna()]
        
    output.write_pandas(robust_select(pdf, INVENTORY_SCHEMA))

@transform.using(
    source_df=Input(RAW_KITS_PATH),
    output=Output(CLEAN_KITS_PATH)
)
def clean_kits(ctx, source_df, output):
    pdf = source_df.dataframe()
    pdf["id"] = range(1, 1 + len(pdf))
    
    if "kit_number" in pdf.columns:
        pdf = pdf[pdf["kit_number"].notna()]
        
    output.write_pandas(robust_select(pdf, KITS_SCHEMA))

@transform.using(
    source_df=Input(RAW_SERVICE_BULLETINS_PATH),
    output=Output(CLEAN_SERVICE_BULLETINS_PATH)
)
def clean_service_bulletins(ctx, source_df, output):
    pdf = source_df.dataframe()
    pdf["id"] = range(1, 1 + len(pdf))
    output.write_pandas(robust_select(pdf, SERVICE_BULLETIN_SCHEMA))

@transform.using(
    source_df=Input(RAW_SHIPMENT_ITEMS_PATH),
    output=Output(CLEAN_SHIPMENT_ITEMS_PATH)
)
def clean_shipment_items(ctx, source_df, output):
    pdf = source_df.dataframe()
    pdf["id"] = range(1, 1 + len(pdf))
    output.write_pandas(robust_select(pdf, SHIPMENT_ITEMS_SCHEMA))

@transform.using(
    source_df=Input(RAW_KIT_ITEMS_PATH),
    output=Output(CLEAN_KIT_ITEMS_PATH)
)
def clean_kit_items(ctx, source_df, output):
    pdf = source_df.dataframe()
    pdf["id"] = range(1, 1 + len(pdf))
    output.write_pandas(robust_select(pdf, KIT_ITEMS_SCHEMA))

@transform.using(
    source_df=Input(RAW_PARTS_CATALOG_PATH),
    output=Output(CLEAN_PARTS_CATALOG_PATH)
)
def clean_parts_catalog(ctx, source_df, output):
    pdf = source_df.dataframe()
    pdf["id"] = range(1, 1 + len(pdf))
    output.write_pandas(robust_select(pdf, PARTS_CATALOG_SCHEMA))

@transform.using(
    flights=Input(CLEAN_FLIGHTS_PATH),
    equipment=Input(CLEAN_EQUIPMENT_PATH),
    output=Output(ONTOLOGY_FLIGHT_PATH)
)
def create_flight_objects(ctx, flights, equipment, output):
    flights_pdf = flights.dataframe()
    equipment_pdf = equipment.dataframe()
    
    # Validation/Cleanup
    if "aircraft_number" not in flights_pdf.columns:
        flights_pdf["aircraft_number"] = None
    if "serial_number" not in equipment_pdf.columns:
        equipment_pdf["serial_number"] = None
        
    # Join
    merged = pd.merge(
        flights_pdf,
        equipment_pdf,
        left_on="aircraft_number",
        right_on="serial_number",
        how="left",
        suffixes=('', '_eq')
    )
    
    # Map to Output Schema (FLIGHT_SCHEMA + aircraft_type)
    # 1. Alias primaryKey
    merged["primaryKey"] = merged["mission_number"]
    
    # 2. Alias aircraft_type from category
    merged["aircraft_type"] = merged["category"] if "category" in merged.columns else None
    
    # 3. Handle status collision (flights status vs equipment status)
    # The join suffixes might result in status_eq. We want the flight status.
    # robust_select will pick "status" from the DF.
    
    # Select columns manually to ensure we get exactly what we want for Ontology
    # We want everything in FLIGHT_SCHEMA + primaryKey + aircraft_type
    
    # Ensure columns exist before selection
    final_columns = [field.name for field in FLIGHT_SCHEMA.fields] + ["primaryKey", "aircraft_type"]
    
    for col in final_columns:
        if col not in merged.columns:
            merged[col] = None
            
    output.write_pandas(merged[final_columns])
