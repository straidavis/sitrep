from pyspark.sql.types import StructType, StructField, StringType, IntegerType, DoubleType, DateType

# Schema Definitions mimicking the SITREP Data Models

FLIGHT_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("date", DateType(), True),
    StructField("mission_number", StringType(), True),
    StructField("aircraft_number", StringType(), True),
    StructField("status", StringType(), True), # Complete, CNX, Delay
    StructField("flight_hours", DoubleType(), True),
    StructField("payload", StringType(), True),
    StructField("weather_conditions", StringType(), True),
    StructField("created_at", StringType(), True)
])

EQUIPMENT_SCHEMA = StructType([
    StructField("id", IntegerType(), False),
    StructField("serial_number", StringType(), True),
    StructField("category", StringType(), True), # Aircraft, Payload, GCS
    StructField("status", StringType(), True), # FMC, PMC, NMC
    StructField("location", StringType(), True),
    StructField("software_version", StringType(), True),
    StructField("last_updated", DateType(), True)
])

DEPLOYMENT_SCHEMA = StructType([
    StructField("deployment_id", StringType(), False),
    StructField("name", StringType(), True),
    StructField("start_date", DateType(), True),
    StructField("end_date", DateType(), True),
    StructField("type", StringType(), True) # Land, Ship
])
