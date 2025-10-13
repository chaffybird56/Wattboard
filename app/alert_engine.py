import json
import smtplib
import requests
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy import select, and_
from .models import db, Alert, AlertEvent, Device, Metric, Site

class AlertEngine:
    def __init__(self, app):
        self.app = app
        
    def evaluate_alerts(self, site_id: int):
        """Evaluate all enabled alerts for a site"""
        with self.app.app_context():
            # Get enabled alerts for the site
            alerts = db.session.scalars(
                select(Alert).where(
                    and_(
                        Alert.site_id == site_id,
                        Alert.enabled == True
                    )
                )
            ).all()
            
            for alert in alerts:
                try:
                    if self._should_evaluate_alert(alert):
                        self._evaluate_alert(alert)
                except Exception as e:
                    print(f"Error evaluating alert {alert.id}: {e}")
    
    def _should_evaluate_alert(self, alert: Alert):
        """Check if alert should be evaluated (not snoozed)"""
        if alert.rule_json.get('snoozed_until'):
            snooze_until = datetime.fromisoformat(alert.rule_json['snoozed_until'])
            if snooze_until > datetime.utcnow():
                return False
        
        # Check schedule if defined
        if 'schedule' in alert.rule_json:
            if not self._is_in_schedule(alert.rule_json['schedule']):
                return False
        
        return True
    
    def _is_in_schedule(self, schedule):
        """Check if current time is within alert schedule"""
        now = datetime.utcnow()
        current_time = now.strftime('%H:%M')
        
        start_time = schedule['start']
        end_time = schedule['end']
        
        # Handle overnight schedules (e.g., 19:00 to 07:00)
        if start_time > end_time:
            return current_time >= start_time or current_time <= end_time
        else:
            return start_time <= current_time <= end_time
    
    def _evaluate_alert(self, alert: Alert):
        """Evaluate a single alert rule"""
        rule = alert.rule_json
        
        if rule['type'] == 'threshold':
            self._evaluate_threshold_alert(alert)
        elif rule['type'] == 'nodata':
            self._evaluate_nodata_alert(alert)
        elif rule['type'] == 'timewindow':
            self._evaluate_timewindow_alert(alert)
    
    def _evaluate_threshold_alert(self, alert: Alert):
        """Evaluate threshold-based alert"""
        rule = alert.rule_json
        device_ids = rule['device_ids']
        key = rule['key']
        op = rule['op']
        value = rule['value']
        duration_sec = rule.get('duration_sec', 0)
        
        # Get recent metrics for the devices
        since = datetime.utcnow() - timedelta(minutes=5)  # Check last 5 minutes
        
        metrics = db.session.scalars(
            select(Metric).where(
                and_(
                    Metric.device_id.in_(device_ids),
                    Metric.key == key,
                    Metric.ts >= since
                )
            ).order_by(Metric.ts.desc())
        ).all()
        
        if not metrics:
            return
        
        # Check if condition is met for the required duration
        condition_met = False
        condition_start = None
        
        for metric in metrics:
            if self._check_threshold_condition(metric.value, op, value):
                if condition_start is None:
                    condition_start = metric.ts
                elif (condition_start - metric.ts).total_seconds() >= duration_sec:
                    condition_met = True
                    break
            else:
                condition_start = None
        
        if condition_met and self._should_fire_alert(alert):
            self._fire_alert(alert, {
                'type': 'threshold',
                'condition': f"{key} {op} {value}",
                'duration': f"{duration_sec}s",
                'devices': device_ids,
                'trigger_value': metrics[0].value
            })
    
    def _evaluate_nodata_alert(self, alert: Alert):
        """Evaluate no-data alert"""
        rule = alert.rule_json
        device_ids = rule['device_ids']
        duration_sec = rule.get('duration_sec', 300)  # Default 5 minutes
        
        since = datetime.utcnow() - timedelta(seconds=duration_sec)
        
        for device_id in device_ids:
            device = db.session.get(Device, device_id)
            if not device:
                continue
                
            # Check if device has recent data
            recent_metric = db.session.scalars(
                select(Metric).where(
                    and_(
                        Metric.device_id == device_id,
                        Metric.ts >= since
                    )
                ).order_by(Metric.ts.desc()).limit(1)
            ).first()
            
            if not recent_metric:
                if self._should_fire_alert(alert):
                    self._fire_alert(alert, {
                        'type': 'nodata',
                        'device_id': device_id,
                        'device_name': device.name,
                        'duration': f"{duration_sec}s",
                        'last_seen': device.last_seen_at.isoformat() if device.last_seen_at else None
                    })
                break
    
    def _evaluate_timewindow_alert(self, alert: Alert):
        """Evaluate time-window alert (same as threshold but with schedule)"""
        self._evaluate_threshold_alert(alert)
    
    def _check_threshold_condition(self, value, op, threshold):
        """Check if value meets threshold condition"""
        if op == 'gt':
            return value > threshold
        elif op == 'lt':
            return value < threshold
        elif op == 'eq':
            return value == threshold
        elif op == 'gte':
            return value >= threshold
        elif op == 'lte':
            return value <= threshold
        return False
    
    def _should_fire_alert(self, alert: Alert):
        """Check if alert should fire (avoid spam)"""
        # Don't fire if fired recently (within last 5 minutes)
        if alert.last_fired_at:
            time_since_last = datetime.utcnow() - alert.last_fired_at
            if time_since_last.total_seconds() < 300:  # 5 minutes
                return False
        
        return True
    
    def _fire_alert(self, alert: Alert, payload: dict):
        """Fire an alert and send notifications"""
        # Update alert last_fired_at
        alert.last_fired_at = datetime.utcnow()
        db.session.commit()
        
        # Create alert event
        alert_event = AlertEvent(
            alert_id=alert.id,
            ts=datetime.utcnow(),
            payload=payload
        )
        db.session.add(alert_event)
        db.session.commit()
        
        # Send notifications
        self._send_notifications(alert, payload)
    
    def _send_notifications(self, alert: Alert, payload: dict):
        """Send alert notifications via email and webhook"""
        rule = alert.rule_json
        
        # Email notification
        if rule.get('action', {}).get('email'):
            self._send_email_notification(alert, payload, rule['action']['email'])
        
        # Webhook notification
        if rule.get('action', {}).get('webhook'):
            self._send_webhook_notification(alert, payload, rule['action']['webhook'])
    
    def _send_email_notification(self, alert: Alert, payload: dict, email_addresses: list):
        """Send email notification"""
        try:
            # Get SMTP settings from config
            smtp_host = self.app.config.get('SMTP_HOST')
            smtp_port = self.app.config.get('SMTP_PORT', 587)
            smtp_user = self.app.config.get('SMTP_USER')
            smtp_password = self.app.config.get('SMTP_PASSWORD')
            
            if not all([smtp_host, smtp_user, smtp_password]):
                print("SMTP not configured, skipping email notification")
                return
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = smtp_user
            msg['To'] = ', '.join(email_addresses)
            msg['Subject'] = f"Wattboard Alert: {alert.name}"
            
            # Create body
            body = f"""
Alert: {alert.name}
Site: {alert.site_id}
Time: {datetime.utcnow().isoformat()}
Type: {payload['type']}

Details:
{json.dumps(payload, indent=2)}

---
Wattboard Energy Monitoring
            """
            
            msg.attach(MIMEText(body, 'plain'))
            
            # Send email
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            server.quit()
            
            print(f"Email notification sent for alert {alert.id}")
            
        except Exception as e:
            print(f"Failed to send email notification: {e}")
    
    def _send_webhook_notification(self, alert: Alert, payload: dict, webhook_urls: list):
        """Send webhook notification"""
        for url in webhook_urls:
            try:
                webhook_payload = {
                    'alert_id': alert.id,
                    'alert_name': alert.name,
                    'site_id': alert.site_id,
                    'timestamp': datetime.utcnow().isoformat(),
                    'payload': payload
                }
                
                response = requests.post(url, json=webhook_payload, timeout=10)
                response.raise_for_status()
                
                print(f"Webhook notification sent to {url} for alert {alert.id}")
                
            except Exception as e:
                print(f"Failed to send webhook notification to {url}: {e}")
    
    def create_preset_alert(self, site_id: int, preset_type: str, **kwargs):
        """Create alert from preset"""
        if preset_type == 'high_draw':
            return self._create_high_draw_alert(site_id, **kwargs)
        elif preset_type == 'over_temp':
            return self._create_over_temp_alert(site_id, **kwargs)
        elif preset_type == 'no_data':
            return self._create_no_data_alert(site_id, **kwargs)
        else:
            raise ValueError(f"Unknown preset type: {preset_type}")
    
    def _create_high_draw_alert(self, site_id: int, device_ids: list, threshold: float, schedule: dict = None):
        """Create high power draw alert"""
        rule = {
            'type': 'threshold',
            'device_ids': device_ids,
            'key': 'power',
            'op': 'gt',
            'value': threshold,
            'duration_sec': 120,  # 2 minutes
            'action': {
                'email': [],
                'webhook': []
            }
        }
        
        if schedule:
            rule['schedule'] = schedule
        
        alert = Alert(
            site_id=site_id,
            name=f"High Power Draw (> {threshold}W)",
            rule_json=rule,
            enabled=True
        )
        
        db.session.add(alert)
        db.session.commit()
        return alert
    
    def _create_over_temp_alert(self, site_id: int, device_ids: list, threshold: float, schedule: dict = None):
        """Create over-temperature alert"""
        rule = {
            'type': 'threshold',
            'device_ids': device_ids,
            'key': 'temp',
            'op': 'gt',
            'value': threshold,
            'duration_sec': 60,  # 1 minute
            'action': {
                'email': [],
                'webhook': []
            }
        }
        
        if schedule:
            rule['schedule'] = schedule
        
        alert = Alert(
            site_id=site_id,
            name=f"Over Temperature (> {threshold}°C)",
            rule_json=rule,
            enabled=True
        )
        
        db.session.add(alert)
        db.session.commit()
        return alert
    
    def _create_no_data_alert(self, site_id: int, device_ids: list, duration_minutes: int = 5):
        """Create no-data alert"""
        rule = {
            'type': 'nodata',
            'device_ids': device_ids,
            'duration_sec': duration_minutes * 60,
            'action': {
                'email': [],
                'webhook': []
            }
        }
        
        alert = Alert(
            site_id=site_id,
            name=f"No Data ({duration_minutes} minutes)",
            rule_json=rule,
            enabled=True
        )
        
        db.session.add(alert)
        db.session.commit()
        return alert

# Background job to evaluate alerts
def run_alert_evaluation_job(app):
    """Background job to evaluate alerts every 30 seconds"""
    with app.app_context():
        engine = AlertEngine(app)
        
        # Get all sites
        sites = db.session.scalars(select(Site)).all()
        
        for site in sites:
            try:
                engine.evaluate_alerts(site.id)
            except Exception as e:
                print(f"Error evaluating alerts for site {site.name}: {e}")
