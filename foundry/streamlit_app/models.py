from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional, List

@dataclass
class Flight:
    mission_number: str
    date: date
    aircraft_number: str
    status: str
    deployment_id: str
    flight_hours: float = 0.0
    scheduled_launch: Optional[str] = None
    launch_time: Optional[str] = None
    recovery_time: Optional[str] = None
    reason_for_delay: Optional[str] = None
    reason_for_cancel: Optional[str] = None
    weather_summary: Optional[str] = None
    risk_level: Optional[str] = "Low"
    notes: Optional[str] = None
    # Start fields
    contraband_lbs: float = 0.0
    detainees: int = 0
    tois: int = 0
    
    @property
    def is_complete(self):
        return self.status == "Complete"

@dataclass
class InventoryItem:
    part_number: str
    description: str
    quantity: int
    deployment_id: str
    min_quantity: int = 0
    location: Optional[str] = None
    
    @property
    def is_low_stock(self):
        return self.quantity <= self.min_quantity

@dataclass
class Equipment:
    serial_number: str
    equipment_type: str
    status: str # FMC, NMC, PMC
    deployment_id: str
    location: Optional[str] = None
