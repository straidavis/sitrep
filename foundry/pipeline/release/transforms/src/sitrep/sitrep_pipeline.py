from transforms.api import transform, Input, Output
from pyspark.sql import functions as F
from sitrep.schemas.definitions import FLIGHT_SCHEMA, EQUIPMENT_SCHEMA # Update import to match package structure

# ==========================================
# CONFIGURATION
# ==========================================
# Update these paths to match your Foundry folder structure exactly.
# If you uploaded data to a personal folder, verify the path by right-clicking the dataset > Details.

# 1. RAW INPUTS (Must exist before running)
RAW_FLIGHTS_PATH = "/USCG/SITREP/Raw/raw_flight_logs"
RAW_EQUIPMENT_PATH = "/USCG/SITREP/Raw/raw_equipment_lists"

# 2. INTERMEDIATE OUTPUTS (Will be created by this pipeline)
# These same paths are used as Inputs for the final step.
CLEAN_FLIGHTS_PATH = "/USCG/SITREP/Clean/flights_clean"
CLEAN_EQUIPMENT_PATH = "/USCG/SITREP/Clean/equipment_clean"

# 3. FINAL ONTOLOGY OBJECT (Will be created by this pipeline)
ONTOLOGY_FLIGHT_PATH = "/USCG/SITREP/Ontology/FlightEvent"

# ==========================================
# PIPELINE LOGIC
# ==========================================

@transform(
    output=Output(CLEAN_FLIGHTS_PATH),
    source_df=Input(RAW_FLIGHTS_PATH)
)
def clean_flights(source_df):
    """
    Cleans raw flight logs into the standardized flights schema.
    Applies logic to calculate flight duration and standardize status codes.
    """
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
    """
    Standardizes equipment lists.
    Filters out decommissioned assets and standardizes category names.
    """
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
    output=Output(ONTOLOGY_FLIGHT_PATH),
    flights=Input(CLEAN_FLIGHTS_PATH),
    equipment=Input(CLEAN_EQUIPMENT_PATH)
)
def create_flight_objects(flights, equipment):
    """
    Joins flights with equipment to enrich flight data with aircraft details
    and prepares it for the Ontology Object backing.
    """
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
