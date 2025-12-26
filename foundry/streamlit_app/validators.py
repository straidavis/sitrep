import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Strict Dictionary for Cancellation/Delay Reasons
# Derived from Client App constants.js
CANCELLATION_REASONS = {
    "Shield AI": [
        "Aircraft", "Avionics", "Back Up AV Used", "Camera Replaced", "Comm's Loss", "Comm's Poor",
        "Customer Directed", "DGPS", "DGPS Failure", "Engine", "Engine - Cut", "Engine - High RPM",
        "Engine - High Temp", "Engine - Low RPM", "Engine - Tach", "Engine Replaced", "Equipment Failure",
        "Flight Controls", "Fuel - Contaminated", "Fuel - Fuel Sensor Calibration", "Fuel - Low",
        "Fuel - None on hand", "Fuel - Ran out of Fuel", "GCS Malfunction", "Generator - AC",
        "Generator - Customer", "Generator - Ground", "GPS - AC", "GPS - Ground", "Ground Equipment",
        "High RPM", "Low RPM", "Poor Communication", "Turret", "Turret Malfunction", "Video",
        "Video None", "Video Poor", "Wing Replacement"
    ],
    "USCG": [
        "Ship - Other", "Ship - RAS", "Out of AO" # Client mapped to USCG
    ],
    "Other": [
        "Interference/Jamming", "Late Flight Authorization", "No Reason Given", "Other",
        "Weather", "Weather - Clear Air Turbulence", "Weather - Crosswinds", "Weather - Dust",
        "Weather - Fog", "Weather - High Seas", "Weather - Hurricane/Typhoon", "Weather - Icing",
        "Weather - Lightning", "Weather - Low Ceiling", "Weather - Low Visibility", "Weather - Rain",
        "Weather - Rain - Drizzle", "Weather - Rain - Freezing", "Weather - Rain - Heavy",
        "Weather - Rain - Light", "Weather - Sandstorm", "Weather - Snow", "Weather - Thunderstorm",
        "Weather - Tornado", "Weather - Turbulence", "Weather - Wind", "Weather - Winds - Gusting"
    ]
}

def parse_excel_date(val):
    """
    Parses Excel serial dates or string dates.
    Matches logic from Flights.jsx lines 219-227.
    """
    if pd.isna(val) or val == '':
        return None
    
    # Check if it's a number (Excel Serial Date)
    if isinstance(val, (int, float)):
        # Excel base date is usually 1899-12-30
        return datetime(1899, 12, 30) + timedelta(days=val)
    
    # Try parsing string
    try:
        return pd.to_datetime(val).date()
    except:
        return None

def parse_excel_time(val):
    """
    Parses Excel fraction-of-day time or string time.
    Matches logic from Flights.jsx lines 229-239.
    """
    if pd.isna(val) or val == '':
        return None
        
    if isinstance(val, (int, float)):
        total_seconds = int(round(val * 86400))
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        return f"{hours:02d}:{minutes:02d}"
    
    return str(val).strip()

def validate_flight_import(df):
    """
    Validates a raw DataFrame from Excel against strict rules.
    Returns (valid_records, errors_list)
    """
    errors = []
    valid = []
    
    # 1. Header Validation
    # Normalize headers
    df.columns = [str(c).strip().lower() for c in df.columns]
    
    required_cols = ['date', 'status']
    missing = [c for c in required_cols if not any(h == c for h in df.columns)]
    
    if missing:
        return [], [f"Missing critical columns: {', '.join(missing)}"]
        
    # Column Mapping (Best Effort)
    mapper = {
        'date': 'date',
        'status': 'status',
        'mission': 'mission_number',
        'mission #': 'mission_number',
        'aircraft': 'aircraft_number',
        'hours': 'flight_hours',
        'launch': 'launch_time',
        'recovery': 'recovery_time',
        'reason': 'reason_for_delay',
        'risk': 'risk_level',
        'responsible': 'responsible_part',
        'part': 'responsible_part'
    }
    
    # 2. Row Processing
    for idx, row in df.iterrows():
        try:
            # Map Row
            clean_row = {}
            for col in df.columns:
                # Find matching key
                target_key = None
                for k, v in mapper.items():
                    if k in col: 
                        target_key = v
                        break
                if target_key:
                    clean_row[target_key] = row[col]
            
            # Validation Logic
            if pd.isna(clean_row.get('date')):
                continue # Skip empty rows
                
            # Parse Date
            clean_row['date'] = parse_excel_date(clean_row['date'])
            if not clean_row['date']:
                errors.append(f"Row {idx+2}: Invalid Date")
                continue
                
            # Parse Time
            if 'launch_time' in clean_row:
                clean_row['launch_time'] = parse_excel_time(clean_row['launch_time'])
                
            # Defaults
            status_val = str(clean_row.get('status', 'Complete')).strip()
            clean_row['status'] = status_val
            clean_row['flight_hours'] = float(clean_row.get('flight_hours', 0.0))
            
            # Responsible Part Logic
            if status_val.upper() == 'COMPLETE':
                clean_row['responsible_part'] = 'N/A'
                clean_row['reason_for_delay'] = ''
            else:
                # Strict Validation for CNX/DELAY
                # 1. Check/Derive Responsible Party
                r_part = clean_row.get('responsible_part', 'Unknown')
                if r_part not in CANCELLATION_REASONS:
                    # Try to derive from reason if possible
                    found_key = None
                    input_reason = clean_row.get('reason_for_delay', '')
                    
                    for key, reasons in CANCELLATION_REASONS.items():
                        if input_reason in reasons:
                            found_key = key
                            break
                    
                    if found_key:
                        clean_row['responsible_part'] = found_key
                    else:
                        errors.append(f"Row {idx+2}: Invalid Responsible Party '{r_part}' and Reason '{input_reason}'")
                        continue
                else:
                    clean_row['responsible_part'] = r_part
                
                # 2. Check Reason Code
                valid_reasons = CANCELLATION_REASONS.get(clean_row['responsible_part'], [])
                if clean_row.get('reason_for_delay') not in valid_reasons:
                     errors.append(f"Row {idx+2}: Invalid Reason Code '{clean_row.get('reason_for_delay')}' for {clean_row['responsible_part']}")
                     continue
            
            valid.append(clean_row)
            
        except Exception as e:
            errors.append(f"Row {idx+2}: Conversion Error ({str(e)})")
            
    return valid, errors
