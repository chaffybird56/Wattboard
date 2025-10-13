from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint, ForeignKey, JSON
from datetime import datetime
import json

db = SQLAlchemy()

# New multi-site data model
class Site(db.Model):
    __tablename__ = "sites"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    tz = db.Column(db.String(64), default='America/Toronto')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Room(db.Model):
    __tablename__ = "rooms"
    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(db.Integer, ForeignKey('sites.id'), nullable=False)
    name = db.Column(db.String(128), nullable=False)

class Device(db.Model):
    __tablename__ = "devices"
    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(db.Integer, ForeignKey('sites.id'), nullable=False)
    room_id = db.Column(db.Integer, ForeignKey('rooms.id'), nullable=True)
    name = db.Column(db.String(128), nullable=False)
    type = db.Column(db.String(32), nullable=False)  # power, voltage, current, temp, aqi, humidity
    unit = db.Column(db.String(16), nullable=False)  # W, V, A, °C, AQI, %
    capabilities = db.Column(JSON, default=list)  # ["realtime","historical","alarms"]
    last_seen_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)

class Metric(db.Model):
    __tablename__ = "metrics"
    id = db.Column(db.Integer, primary_key=True)
    ts = db.Column(db.DateTime, index=True, nullable=False)
    device_id = db.Column(db.Integer, ForeignKey('devices.id'), nullable=False)
    key = db.Column(db.String(32), nullable=False)  # power, voltage, current, etc.
    value = db.Column(db.Float, nullable=False)
    __table_args__ = (UniqueConstraint("device_id", "ts", "key", name="uq_device_ts_key"),)

class Event(db.Model):
    __tablename__ = "events"
    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(db.Integer, ForeignKey('sites.id'), nullable=False)
    start_ts = db.Column(db.DateTime, index=True, nullable=False)
    end_ts = db.Column(db.DateTime, index=True, nullable=False)
    type = db.Column(db.String(16), nullable=False)  # spike, sag, unknown
    severity = db.Column(db.Integer, nullable=False)  # 1-5
    device_ids = db.Column(JSON, nullable=False)  # [1,2,3]
    meta = db.Column(JSON, nullable=True)  # {peak_value, zmax, baseline_mu, baseline_sigma}

class Alert(db.Model):
    __tablename__ = "alerts"
    id = db.Column(db.Integer, primary_key=True)
    site_id = db.Column(db.Integer, ForeignKey('sites.id'), nullable=False)
    name = db.Column(db.String(128), nullable=False)
    rule_json = db.Column(JSON, nullable=False)
    enabled = db.Column(db.Boolean, default=True)
    last_fired_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AlertEvent(db.Model):
    __tablename__ = "alert_events"
    id = db.Column(db.Integer, primary_key=True)
    alert_id = db.Column(db.Integer, ForeignKey('alerts.id'), nullable=False)
    ts = db.Column(db.DateTime, index=True, nullable=False)
    payload = db.Column(JSON, nullable=False)

# Legacy models for backward compatibility during migration
class Meter(db.Model):
    __tablename__ = "meters"
    id = db.Column(db.Integer, primary_key=True)
    meter_id = db.Column(db.String(64), unique=True, nullable=False)
    voltage_level = db.Column(db.String(8), nullable=False, default="LV")  # MV/LV
    feeder = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Reading(db.Model):
    __tablename__ = "readings"
    id = db.Column(db.Integer, primary_key=True)
    meter_id = db.Column(db.String(64), index=True, nullable=False)
    ts = db.Column(db.DateTime, index=True, nullable=False)
    kw = db.Column(db.Float)      # instantaneous kW (or interval kW)
    kvar = db.Column(db.Float)
    volts = db.Column(db.Float)
    hertz = db.Column(db.Float)
    quality_ok = db.Column(db.Boolean, default=True)
    __table_args__ = (UniqueConstraint("meter_id", "ts", name="uq_meter_ts"),)

class DailySummary(db.Model):
    __tablename__ = "daily_summaries"
    id = db.Column(db.Integer, primary_key=True)
    meter_id = db.Column(db.String(64), index=True, nullable=False)
    date = db.Column(db.Date, index=True, nullable=False)
    kwh = db.Column(db.Float)     # daily energy
    peak_kw = db.Column(db.Float)
    peak_ts = db.Column(db.DateTime)
    min_voltage = db.Column(db.Float)
    dq_missing_pct = db.Column(db.Float)

def init_db():
    db.create_all()
    
    # Seed initial data if no sites exist
    if not Site.query.first():
        # Create default sites
        home_site = Site(name="Home", tz="America/Toronto")
        lab_site = Site(name="Lab", tz="America/Toronto")
        db.session.add(home_site)
        db.session.add(lab_site)
        
        # Create demo devices
        home_room = Room(site_id=1, name="Main Panel")
        lab_room = Room(site_id=2, name="Test Bench")
        db.session.add(home_room)
        db.session.add(lab_room)
        
        # Home devices
        home_meter = Device(
            site_id=1, room_id=1, name="Main Meter", 
            type="power", unit="W", 
            capabilities=["realtime", "historical", "alarms"]
        )
        home_voltage = Device(
            site_id=1, room_id=1, name="Voltage Sensor", 
            type="voltage", unit="V", 
            capabilities=["realtime", "historical"]
        )
        
        # Lab devices
        lab_meter = Device(
            site_id=2, room_id=2, name="Test Load", 
            type="power", unit="W", 
            capabilities=["realtime", "historical", "alarms"]
        )
        lab_temp = Device(
            site_id=2, room_id=2, name="Temperature", 
            type="temp", unit="°C", 
            capabilities=["realtime", "historical"]
        )
        
        db.session.add_all([home_meter, home_voltage, lab_meter, lab_temp])
        db.session.commit()