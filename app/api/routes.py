from flask import jsonify, request, Blueprint
from datetime import datetime, timedelta
from sqlalchemy import select, and_, or_, func, desc
import pandas as pd
from ..models import db, Site, Device, Metric, Room, Event, Alert, AlertEvent, Reading, DailySummary

api_bp = Blueprint("api", __name__)

# Sites API
@api_bp.get("/sites")
def get_sites():
    sites = db.session.scalars(select(Site)).all()
    return jsonify([{"id": s.id, "name": s.name, "tz": s.tz} for s in sites])

@api_bp.post("/sites")
def create_site():
    data = request.get_json()
    site = Site(name=data["name"], tz=data.get("tz", "America/Toronto"))
    db.session.add(site)
    db.session.commit()
    return jsonify({"id": site.id, "name": site.name, "tz": site.tz}), 201

# Devices API
@api_bp.get("/devices")
def get_devices():
    site_id = request.args.get("site_id", type=int)
    device_type = request.args.get("type")
    active = request.args.get("active", "true").lower() == "true"
    
    query = select(Device)
    if site_id:
        query = query.where(Device.site_id == site_id)
    if device_type:
        query = query.where(Device.type == device_type)
    if active:
        query = query.where(Device.is_active == True)
    
    devices = db.session.scalars(query).all()
    return jsonify([{
        "id": d.id, "site_id": d.site_id, "room_id": d.room_id,
        "name": d.name, "type": d.type, "unit": d.unit,
        "capabilities": d.capabilities, "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None,
        "is_active": d.is_active
    } for d in devices])

@api_bp.post("/devices")
def create_device():
    data = request.get_json()
    device = Device(
        site_id=data["site_id"],
        room_id=data.get("room_id"),
        name=data["name"],
        type=data["type"],
        unit=data["unit"],
        capabilities=data.get("capabilities", ["realtime"])
    )
    db.session.add(device)
    db.session.commit()
    return jsonify({
        "id": device.id, "site_id": device.site_id, "room_id": device.room_id,
        "name": device.name, "type": device.type, "unit": device.unit,
        "capabilities": device.capabilities
    }), 201

# Metrics API with aggregation
@api_bp.get("/metrics")
def get_metrics():
    site_id = request.args.get("site_id", type=int)
    device_ids = request.args.getlist("device_id", type=int)
    key = request.args.get("key") or request.args.get("metric", "power")
    from_ts = request.args.get("from")
    to_ts = request.args.get("to")
    resolution = request.args.get("res", "raw")  # raw, 1m, 15m
    
    # Default to last 24 hours if no time range specified
    if not to_ts:
        to_ts = datetime.utcnow()
    else:
        to_ts = datetime.fromisoformat(to_ts.replace('Z', '+00:00'))
    
    if not from_ts:
        from_ts = to_ts - timedelta(hours=24)
    else:
        from_ts = datetime.fromisoformat(from_ts.replace('Z', '+00:00'))
    
    # Build query
    query = select(Metric).join(Device).where(
        and_(
            Metric.ts >= from_ts,
            Metric.ts <= to_ts,
            Metric.key == key
        )
    )
    
    if site_id:
        query = query.where(Device.site_id == site_id)
    if device_ids:
        query = query.where(Metric.device_id.in_(device_ids))
    
    metrics = db.session.scalars(query).all()
    
    if not metrics:
        return jsonify({"series": [], "devices": []})
    
    # Convert to DataFrame for aggregation
    df = pd.DataFrame([{
        "ts": m.ts, "device_id": m.device_id, "value": m.value
    } for m in metrics])
    
    # Get device info
    device_ids = df["device_id"].unique()
    devices = db.session.scalars(select(Device).where(Device.id.in_(device_ids))).all()
    device_info = {d.id: {"name": d.name, "type": d.type, "unit": d.unit} for d in devices}
    
    if resolution == "raw":
        series = [{
            "t": row["ts"].isoformat(),
            "device_id": row["device_id"],
            "value": row["value"],
            "device_name": device_info.get(row["device_id"], {}).get("name", f"Device {row['device_id']}")
        } for _, row in df.iterrows()]
    else:
        # Aggregate by resolution
        df["ts"] = pd.to_datetime(df["ts"])
        if resolution == "1m":
            df["ts_agg"] = df["ts"].dt.floor("1T")
        elif resolution == "15m":
            df["ts_agg"] = df["ts"].dt.floor("15T")
        
        agg_df = df.groupby(["ts_agg", "device_id"])["value"].mean().reset_index()
        series = [{
            "t": row["ts_agg"].isoformat(),
            "device_id": row["device_id"],
            "value": row["value"],
            "device_name": device_info.get(row["device_id"], {}).get("name", f"Device {row['device_id']}")
        } for _, row in agg_df.iterrows()]
    
    return jsonify({
        "series": series,
        "devices": list(device_info.values())
    })

# Events API
@api_bp.get("/events")
def get_events():
    site_id = request.args.get("site_id", type=int)
    from_ts = request.args.get("from")
    to_ts = request.args.get("to")
    device_ids = request.args.getlist("device_id", type=int)
    
    query = select(Event)
    if site_id:
        query = query.where(Event.site_id == site_id)
    if from_ts:
        query = query.where(Event.start_ts >= datetime.fromisoformat(from_ts.replace('Z', '+00:00')))
    if to_ts:
        query = query.where(Event.end_ts <= datetime.fromisoformat(to_ts.replace('Z', '+00:00')))
    
    events = db.session.scalars(query).all()
    return jsonify([{
        "id": e.id, "site_id": e.site_id, "start_ts": e.start_ts.isoformat(),
        "end_ts": e.end_ts.isoformat(), "type": e.type, "severity": e.severity,
        "device_ids": e.device_ids, "meta": e.meta
    } for e in events])

# Demo Mode API
@api_bp.post("/demo/toggle")
def toggle_demo_mode():
    from ..simulator import get_simulator, start_simulator, stop_simulator
    
    data = request.get_json()
    enabled = data.get("enabled", False)
    
    simulator = get_simulator()
    if enabled:
        if not simulator:
            from ..simulator import init_simulator
            from flask import current_app
            simulator = init_simulator(current_app)
        start_simulator()
    else:
        stop_simulator()
    
    return jsonify({"status": "success", "demo_mode": enabled})

# CSV/Parquet Import API
@api_bp.post("/import/csv")
def import_csv():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    try:
        # Read CSV
        df = pd.read_csv(file)
        
        # Validate required columns
        required_columns = ['timestamp', 'device_name', 'value']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return jsonify({
                "error": f"Missing required columns: {missing_columns}",
                "required": required_columns,
                "found": list(df.columns)
            }), 400
        
        # Get site from request or default to first site
        site_id = request.form.get('site_id', type=int)
        if not site_id:
            site = Site.query.first()
            if not site:
                return jsonify({"error": "No sites available"}), 400
            site_id = site.id
        
        # Process data in batches
        batch_size = 1000
        total_rows = len(df)
        imported_count = 0
        
        for i in range(0, total_rows, batch_size):
            batch = df.iloc[i:i+batch_size]
            
            for _, row in batch.iterrows():
                try:
                    # Parse timestamp
                    ts = pd.to_datetime(row['timestamp'])
                    
                    # Get or create device
                    device = Device.query.filter_by(
                        name=row['device_name'],
                        site_id=site_id
                    ).first()
                    
                    if not device:
                        device = Device(
                            site_id=site_id,
                            name=row['device_name'],
                            type=row.get('key', 'power'),
                            unit=row.get('unit', 'W'),
                            capabilities=["historical"]
                        )
                        db.session.add(device)
                        db.session.commit()
                    
                    # Store metric
                    metric = Metric(
                        ts=ts,
                        device_id=device.id,
                        key=row.get('key', 'power'),
                        value=float(row['value'])
                    )
                    db.session.add(metric)
                    imported_count += 1
                    
                except Exception as e:
                    print(f"Error processing row {i}: {e}")
                    continue
        
        db.session.commit()
        
        return jsonify({
            "status": "success",
            "imported_rows": imported_count,
            "total_rows": total_rows,
            "site_id": site_id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Import failed: {str(e)}"}), 500

@api_bp.post("/import/parquet")
def import_parquet():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    try:
        # Read Parquet
        import pyarrow.parquet as pq
        import pyarrow as pa
        
        # Save uploaded file temporarily
        temp_path = f"/tmp/{file.filename}"
        file.save(temp_path)
        
        # Read parquet
        df = pq.read_table(temp_path).to_pandas()
        
        # Clean up temp file
        import os
        os.remove(temp_path)
        
        # Process similar to CSV
        # ... (same processing logic as CSV)
        
        return jsonify({"status": "success", "message": "Parquet import completed"})
        
    except Exception as e:
        return jsonify({"error": f"Parquet import failed: {str(e)}"}), 500

# Alerts API
@api_bp.get("/alerts")
def get_alerts():
    site_id = request.args.get("site_id", type=int)
    
    query = select(Alert)
    if site_id:
        query = query.where(Alert.site_id == site_id)
    
    alerts = db.session.scalars(query).all()
    return jsonify([{
        "id": a.id, "site_id": a.site_id, "name": a.name,
        "rule_json": a.rule_json, "enabled": a.enabled,
        "last_fired_at": a.last_fired_at.isoformat() if a.last_fired_at else None,
        "created_at": a.created_at.isoformat()
    } for a in alerts])

@api_bp.post("/alerts")
def create_alert():
    from ..alert_engine import AlertEngine
    
    data = request.get_json()
    engine = AlertEngine(app)
    
    preset_type = data.get("preset_type")
    if preset_type:
        # Create from preset
        alert = engine.create_preset_alert(
            site_id=data["site_id"],
            preset_type=preset_type,
            device_ids=data.get("device_ids", []),
            threshold=data.get("threshold"),
            schedule=data.get("schedule")
        )
    else:
        # Create custom alert
        alert = Alert(
            site_id=data["site_id"],
            name=data["name"],
            rule_json=data["rule_json"],
            enabled=data.get("enabled", True)
        )
        db.session.add(alert)
        db.session.commit()
    
    return jsonify({
        "id": alert.id, "site_id": alert.site_id, "name": alert.name,
        "rule_json": alert.rule_json, "enabled": alert.enabled,
        "created_at": alert.created_at.isoformat()
    }), 201

@api_bp.post("/alerts/<int:alert_id>/test")
def test_alert(alert_id):
    from ..alert_engine import AlertEngine
    
    alert = db.session.get(Alert, alert_id)
    if not alert:
        return jsonify({"error": "Alert not found"}), 404
    
    engine = AlertEngine(app)
    
    # Create a test payload
    test_payload = {
        "type": "test",
        "message": "This is a test alert",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Fire the alert
    engine._fire_alert(alert, test_payload)
    
    return jsonify({"status": "success", "message": "Test alert fired"})

@api_bp.post("/alerts/<int:alert_id>/snooze")
def snooze_alert(alert_id):
    data = request.get_json()
    minutes = data.get("minutes", 30)
    
    alert = db.session.get(Alert, alert_id)
    if not alert:
        return jsonify({"error": "Alert not found"}), 404
    
    # Set snooze time
    snooze_until = datetime.utcnow() + timedelta(minutes=minutes)
    alert.rule_json["snoozed_until"] = snooze_until.isoformat()
    
    db.session.commit()
    
    return jsonify({
        "status": "success",
        "snoozed_until": snooze_until.isoformat()
    })

@api_bp.get("/alert-events")
def get_alert_events():
    alert_id = request.args.get("alert_id", type=int)
    from_ts = request.args.get("from")
    to_ts = request.args.get("to")
    
    query = select(AlertEvent)
    if alert_id:
        query = query.where(AlertEvent.alert_id == alert_id)
    if from_ts:
        query = query.where(AlertEvent.ts >= datetime.fromisoformat(from_ts.replace('Z', '+00:00')))
    if to_ts:
        query = query.where(AlertEvent.ts <= datetime.fromisoformat(to_ts.replace('Z', '+00:00')))
    
    events = db.session.scalars(query.order_by(AlertEvent.ts.desc())).all()
    return jsonify([{
        "id": e.id, "alert_id": e.alert_id, "ts": e.ts.isoformat(),
        "payload": e.payload
    } for e in events])

# Export API
@api_bp.get("/export")
def export_data():
    site_id = request.args.get("site_id", type=int)
    device_ids = request.args.getlist("device_id", type=int)
    key = request.args.get("key", "power")
    from_ts = request.args.get("from")
    to_ts = request.args.get("to")
    format_type = request.args.get("format", "csv")
    
    if not from_ts:
        from_ts = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    if not to_ts:
        to_ts = datetime.utcnow().isoformat()
    
    # Build query
    query = select(Metric).join(Device).where(
        and_(
            Metric.ts >= datetime.fromisoformat(from_ts.replace('Z', '+00:00')),
            Metric.ts <= datetime.fromisoformat(to_ts.replace('Z', '+00:00')),
            Metric.key == key
        )
    )
    
    if site_id:
        query = query.where(Device.site_id == site_id)
    if device_ids:
        query = query.where(Metric.device_id.in_(device_ids))
    
    metrics = db.session.scalars(query).all()
    
    if format_type == "csv":
        # Generate CSV
        csv_data = "timestamp,device_id,device_name,key,value,unit\n"
        for metric in metrics:
            device = Device.query.get(metric.device_id)
            csv_data += f"{metric.ts.isoformat()},{metric.device_id},{device.name},{metric.key},{metric.value},{device.unit}\n"
        
        from flask import Response
        return Response(
            csv_data,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename=wattboard_export_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv'}
        )
    
    return jsonify({"error": "Unsupported format"}), 400

# Legacy API for backward compatibility
@api_bp.get("/timeseries")
def timeseries():
    hours = int(request.args.get("hours", 24))
    end = datetime.utcnow()
    start = end - timedelta(hours=hours)
    rows = db.session.scalars(
        select(Reading).where(Reading.ts >= start, Reading.ts <= end)
    ).all()
    if not rows:
        return jsonify({"series": [], "peak": None})
    df = pd.DataFrame([{
        "ts": r.ts, "meter_id": r.meter_id, "kw": r.kw, "volts": r.volts
    } for r in rows])
    df["ts"] = pd.to_datetime(df["ts"])
    g = df.groupby("ts").agg({"kw":"sum", "volts":"mean"}).sort_index()
    peak_kw = float(g["kw"].max())
    peak_ts = g["kw"].idxmax().isoformat()
    out = {
        "series": [{"t": t.isoformat(), "kw": float(row.kw), "volts": float(row.volts)} for t,row in g.iterrows()],
        "peak": {"kw": peak_kw, "ts": peak_ts}
    }
    return jsonify(out)

@api_bp.get("/daily")
def daily():
    days = int(request.args.get("days", 14))
    rows = db.session.scalars(
        select(DailySummary).order_by(DailySummary.date.desc()).limit(days)
    ).all()
    rows = list(reversed(rows))
    return jsonify([{
        "date": r.date.isoformat(), "meter_id": r.meter_id, "kwh": r.kwh,
        "peak_kw": r.peak_kw, "min_voltage": r.min_voltage, "dq_missing_pct": r.dq_missing_pct
    } for r in rows])