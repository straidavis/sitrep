from transforms.api import transform, Input, Output
from pyspark.sql import functions as F
from sitrep.schemas.definitions import FLIGHT_SCHEMA, EQUIPMENT_SCHEMA, DEPLOYMENT_SCHEMA

# ==========================================
# CONFIGURATION
# ==========================================
# Update these paths to match your Foundry folder structure exactly.

# 1. RAW INPUTS
RAW_FLIGHTS_PATH = "/USCG/SITREP/Raw/raw_flight_logs"
RAW_EQUIPMENT_PATH = "/USCG/SITREP/Raw/raw_equipment_lists"
RAW_DEPLOYMENTS_PATH = "/USCG/SITREP/Raw/raw_deployments"

# 2. INTERMEDIATE OUTPUTS
CLEAN_FLIGHTS_PATH = "/USCG/SITREP/Clean/flights_clean"
CLEAN_EQUIPMENT_PATH = "/USCG/SITREP/Clean/equipment_clean"
CLEAN_DEPLOYMENTS_PATH = "/USCG/SITREP/Clean/deployments_clean"

# 3. FINAL ONTOLOGY OBJECT
ONTOLOGY_FLIGHT_PATH = "/USCG/SITREP/Ontology/FlightEvent"

# ==========================================
# PIPELINE LOGIC
# ==========================================

@transform(
    output=Output(CLEAN_FLIGHTS_PATH),
    source_df=Input(RAW_FLIGHTS_PATH)
)
def clean_flights(source_df):
    return (
        source_df
        .withColumnRenamed("Date", "date")
        .withColumnRenamed("Mission #", "mission_number")
        .withColumnRenamed("Aircraft #", "aircraft_number")
        .withColumn("flight_hours", F.col("Hours").cast("double"))
        .withColumn("status", F.upper(F.col("Status")))
        .filter(F.col("mission_number").isNotNull())
    )

@transform(
    output=Output(CLEAN_EQUIPMENT_PATH),
    source_df=Input(RAW_EQUIPMENT_PATH)
)
def clean_equipment(source_df):
    return (
        source_df
        .select(
            F.col("Serial Number").alias("serial_number"),
            F.col("Category").alias("category"),
            F.col("Status").alias("status"),
            F.col("Software").alias("software_version")
        )
        .withColumn("status_flag", 
            F.when(F.col("status") == "FMC", "GREEN")
             .when(F.col("status") == "NMC", "RED")
             .otherwise("YELLOW")
        )
    )

@transform(
    output=Output(CLEAN_DEPLOYMENTS_PATH),
    source_df=Input(RAW_DEPLOYMENTS_PATH)
)
def clean_deployments(source_df):
    """
    Cleans deployment data.
    """
    return (
        source_df
        .select(
             F.col("Deployment ID").alias("deployment_id"),
             F.col("Name").alias("name"),
             F.col("Start Date").cast("date").alias("start_date"),
             F.col("End Date").cast("date").alias("end_date"),
             F.col("Type").alias("type")
        )
    )

@transform(
    output=Output(ONTOLOGY_FLIGHT_PATH),
    flights=Input(CLEAN_FLIGHTS_PATH),
    equipment=Input(CLEAN_EQUIPMENT_PATH)
)
def create_flight_objects(flights, equipment):
    return flights.join(
        equipment,
        flights.aircraft_number == equipment.serial_number,
        "left"
    ).select(
        flights.mission_number.alias("primaryKey"),
        flights.date,
        flights.flight_hours,
        flights.status,
        equipment.category.alias("aircraft_type")
    )
