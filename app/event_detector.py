import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from .models import db, Device, Metric, Event, Site

class EventDetector:
    def __init__(self, app):
        self.app = app
        self.window_minutes = 15  # Rolling window for statistics
        self.threshold_multiplier = 3.0  # k=3 for spike/sag detection
        self.min_duration_points = 3  # Minimum points to classify as event
        self.debounce_seconds = 60  # Merge events within 60 seconds
        
    def detect_events(self, site_id: int, from_ts: datetime = None, to_ts: datetime = None):
        """Detect spikes and sags for all devices in a site"""
        if not from_ts:
            from_ts = datetime.utcnow() - timedelta(hours=24)
        if not to_ts:
            to_ts = datetime.utcnow()
            
        with self.app.app_context():
            # Get all devices for the site
            devices = db.session.scalars(
                select(Device).where(Device.site_id == site_id, Device.is_active == True)
            ).all()
            
            all_events = []
            
            for device in devices:
                # Get metrics for the device
                metrics = db.session.scalars(
                    select(Metric).where(
                        and_(
                            Metric.device_id == device.id,
                            Metric.ts >= from_ts,
                            Metric.ts <= to_ts
                        )
                    ).order_by(Metric.ts)
                ).all()
                
                if len(metrics) < 10:  # Need at least 10 points for reliable detection
                    continue
                    
                # Convert to DataFrame
                df = pd.DataFrame([{
                    'ts': m.ts,
                    'value': m.value
                } for m in metrics])
                
                df['ts'] = pd.to_datetime(df['ts'])
                df = df.set_index('ts').sort_index()
                
                # Detect events for this device
                device_events = self._detect_device_events(device, df, site_id)
                all_events.extend(device_events)
            
            # Store events in database
            self._store_events(all_events)
            
            return all_events
    
    def _detect_device_events(self, device: Device, df: pd.DataFrame, site_id: int):
        """Detect events for a single device"""
        events = []
        
        # Calculate rolling statistics
        window = f'{self.window_minutes}min'
        df['rolling_median'] = df['value'].rolling(window=window, center=True).median()
        df['rolling_mad'] = df['value'].rolling(window=window, center=True).apply(
            lambda x: np.median(np.abs(x - np.median(x)))
        )
        
        # Convert MAD to standard deviation approximation
        df['rolling_std'] = df['rolling_mad'] * 1.4826
        
        # Calculate z-scores
        df['z_score'] = (df['value'] - df['rolling_median']) / df['rolling_std']
        
        # Identify potential spikes and sags
        df['is_spike'] = df['z_score'] > self.threshold_multiplier
        df['is_sag'] = df['z_score'] < -self.threshold_multiplier
        
        # Group consecutive events
        spike_groups = self._group_consecutive_events(df, 'is_spike')
        sag_groups = self._group_consecutive_events(df, 'is_sag')
        
        # Create events from groups
        for group in spike_groups:
            if len(group) >= self.min_duration_points:
                event = self._create_event(
                    device, site_id, group, 'spike', df
                )
                if event:
                    events.append(event)
        
        for group in sag_groups:
            if len(group) >= self.min_duration_points:
                event = self._create_event(
                    device, site_id, group, 'sag', df
                )
                if event:
                    events.append(event)
        
        return events
    
    def _group_consecutive_events(self, df: pd.DataFrame, event_column: str):
        """Group consecutive True values in the event column"""
        groups = []
        current_group = []
        
        for i, (ts, row) in enumerate(df.iterrows()):
            if row[event_column]:
                current_group.append((ts, i))
            else:
                if current_group:
                    groups.append(current_group)
                    current_group = []
        
        if current_group:
            groups.append(current_group)
            
        return groups
    
    def _create_event(self, device: Device, site_id: int, group, event_type: str, df: pd.DataFrame):
        """Create an event from a group of consecutive points"""
        if not group:
            return None
            
        start_ts = group[0][0]
        end_ts = group[-1][0]
        
        # Check for debouncing (merge with nearby events)
        existing_events = db.session.scalars(
            select(Event).where(
                and_(
                    Event.site_id == site_id,
                    Event.device_ids.contains([device.id]),
                    Event.type == event_type,
                    Event.end_ts >= start_ts - timedelta(seconds=self.debounce_seconds),
                    Event.start_ts <= end_ts + timedelta(seconds=self.debounce_seconds)
                )
            )
        ).all()
        
        if existing_events:
            # Merge with existing event
            existing = existing_events[0]
            existing.start_ts = min(existing.start_ts, start_ts)
            existing.end_ts = max(existing.end_ts, end_ts)
            db.session.commit()
            return None
        
        # Calculate event properties
        group_indices = [g[1] for g in group]
        group_values = df.iloc[group_indices]['value']
        group_z_scores = df.iloc[group_indices]['z_score']
        
        peak_value = group_values.max() if event_type == 'spike' else group_values.min()
        max_z_score = group_z_scores.abs().max()
        
        # Calculate severity (1-5)
        severity = min(5, max(1, int(max_z_score)))
        
        # Calculate baseline statistics
        baseline_mu = df.iloc[group_indices[0]]['rolling_median']
        baseline_sigma = df.iloc[group_indices[0]]['rolling_std']
        
        meta = {
            'peak_value': float(peak_value),
            'zmax': float(max_z_score),
            'baseline_mu': float(baseline_mu),
            'baseline_sigma': float(baseline_sigma)
        }
        
        return {
            'site_id': site_id,
            'start_ts': start_ts,
            'end_ts': end_ts,
            'type': event_type,
            'severity': severity,
            'device_ids': [device.id],
            'meta': meta
        }
    
    def _store_events(self, events):
        """Store events in the database"""
        for event_data in events:
            # Check if event already exists (by time and device)
            existing = db.session.scalars(
                select(Event).where(
                    and_(
                        Event.site_id == event_data['site_id'],
                        Event.start_ts == event_data['start_ts'],
                        Event.device_ids == event_data['device_ids']
                    )
                )
            ).first()
            
            if not existing:
                event = Event(**event_data)
                db.session.add(event)
        
        db.session.commit()
    
    def get_events(self, site_id: int, from_ts: datetime = None, to_ts: datetime = None, device_ids: list = None):
        """Get events for a site with optional filtering"""
        with self.app.app_context():
            query = select(Event).where(Event.site_id == site_id)
            
            if from_ts:
                query = query.where(Event.start_ts >= from_ts)
            if to_ts:
                query = query.where(Event.end_ts <= to_ts)
            if device_ids:
                # Filter events that involve any of the specified devices
                query = query.where(
                    Event.device_ids.op('&&')(device_ids)  # PostgreSQL array overlap
                )
            
            events = db.session.scalars(query.order_by(Event.start_ts.desc())).all()
            return events

# Background job to run event detection periodically
def run_event_detection_job(app):
    """Background job to detect events every 5 minutes"""
    with app.app_context():
        detector = EventDetector(app)
        
        # Get all sites
        sites = db.session.scalars(select(Site)).all()
        
        for site in sites:
            try:
                # Detect events for the last hour
                from_ts = datetime.utcnow() - timedelta(hours=1)
                to_ts = datetime.utcnow()
                
                events = detector.detect_events(site.id, from_ts, to_ts)
                print(f"Detected {len(events)} events for site {site.name}")
                
            except Exception as e:
                print(f"Error detecting events for site {site.name}: {e}")
