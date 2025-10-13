import threading, json
from datetime import datetime
import pandas as pd
import paho.mqtt.client as mqtt
from .models import db, Reading, Meter, Device, Metric, Site

def start_mqtt_worker(app):
    t = threading.Thread(target=_run, args=(app,), daemon=True)
    t.start()

def _run(app):
    with app.app_context():
        host = app.config["MQTT_BROKER_HOST"]; port = int(app.config["MQTT_BROKER_PORT"])
        topics = [t.strip() for t in app.config["MQTT_TOPICS"].split(",")]
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        client.on_connect = lambda c,u,fl,rc,props=None: [_subscribe(c, t) for t in topics]
        client.on_message = lambda c,u,msg: _handle_message(app, msg)
        client.connect(host, port)
        client.loop_forever()

def _subscribe(client, topic):
    client.subscribe(topic, qos=1)

def _handle_message(app, msg):
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except Exception:
        return
    
    parts = msg.topic.split("/")
    device_name = parts[2] if len(parts) >= 3 else payload.get("device_name", "UNKNOWN")
    site_name = payload.get("site", "Home")  # Default to Home site
    
    # Get or create site
    site = Site.query.filter_by(name=site_name).first()
    if not site:
        site = Site(name=site_name, tz="America/Toronto")
        db.session.add(site)
        db.session.commit()
    
    # Get or create device
    device = Device.query.filter_by(name=device_name, site_id=site.id).first()
    if not device:
        device = Device(
            site_id=site.id,
            name=device_name,
            type=payload.get("type", "power"),
            unit=payload.get("unit", "W"),
            capabilities=["realtime", "historical"]
        )
        db.session.add(device)
        db.session.commit()
    
    # Update device last_seen
    device.last_seen_at = datetime.utcnow()
    
    # Parse timestamp
    ts = pd.to_datetime(payload.get("ts", datetime.utcnow())).to_pydatetime()
    
    # Store metrics based on payload keys
    metric_keys = {
        "kw": "power", "power": "power", "w": "power",
        "volts": "voltage", "voltage": "voltage", "v": "voltage",
        "kvar": "reactive_power", "reactive_power": "reactive_power",
        "hertz": "frequency", "frequency": "frequency", "hz": "frequency",
        "temp": "temp", "temperature": "temp",
        "aqi": "aqi", "humidity": "humidity"
    }
    
    for payload_key, metric_key in metric_keys.items():
        if payload_key in payload and payload[payload_key] is not None:
            # Validate unit compatibility
            if _validate_unit(device.unit, payload_key):
                metric = Metric(
                    ts=ts,
                    device_id=device.id,
                    key=metric_key,
                    value=float(payload[payload_key])
                )
                db.session.add(metric)
    
    # Legacy support for old format
    if "kw" in payload or "volts" in payload:
        meter_id = f"{site_name}_{device_name}"
        r = Reading(
            meter_id=meter_id, ts=ts,
            kw=payload.get("kw"), kvar=payload.get("kvar"),
            volts=payload.get("volts"), hertz=payload.get("hertz")
        )
        m = Meter.query.filter_by(meter_id=meter_id).first()
        if not m:
            m = Meter(meter_id=meter_id, voltage_level=payload.get("voltage_level","LV"), feeder=payload.get("feeder"))
            db.session.add(m)
        db.session.add(r)
    
    db.session.commit()

def _validate_unit(device_unit, payload_key):
    """Validate that the payload key matches the device unit"""
    unit_mappings = {
        "W": ["kw", "power", "w"],
        "V": ["volts", "voltage", "v"],
        "A": ["current", "amps"],
        "°C": ["temp", "temperature"],
        "AQI": ["aqi"],
        "%": ["humidity", "percent"]
    }
    
    for unit, keys in unit_mappings.items():
        if device_unit == unit:
            return payload_key in keys
    
    return True  # Allow unknown combinations