import random
import json
import time
import threading
from datetime import datetime, timedelta
import pandas as pd
import paho.mqtt.client as mqtt
from .models import db, Site, Device, Metric

class DeterministicSimulator:
    def __init__(self, app, broker_host='localhost', broker_port=1883):
        self.app = app
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.running = False
        self.client = None
        self.seed = 42  # Fixed seed for deterministic behavior
        
        # Device configurations
        self.devices = [
            {"name": "Main Meter", "site": "Home", "type": "power", "unit": "W", "base_power": 1200},
            {"name": "Voltage Sensor", "site": "Home", "type": "voltage", "unit": "V", "base_voltage": 240},
            {"name": "Test Load", "site": "Lab", "type": "power", "unit": "W", "base_power": 800},
            {"name": "Temperature", "site": "Lab", "type": "temp", "unit": "°C", "base_temp": 22},
            {"name": "AQI Sensor", "site": "Home", "type": "aqi", "unit": "AQI", "base_aqi": 50}
        ]
        
        # Initialize random seed
        random.seed(self.seed)
        
    def start(self):
        """Start the simulator in a background thread"""
        if self.running:
            return
            
        self.running = True
        thread = threading.Thread(target=self._run, daemon=True)
        thread.start()
        
    def stop(self):
        """Stop the simulator"""
        self.running = False
        if self.client:
            self.client.disconnect()
            
    def _run(self):
        """Main simulation loop"""
        with self.app.app_context():
            # Connect to MQTT broker
            self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
            try:
                self.client.connect(self.broker_host, self.broker_port)
                self.client.loop_start()
                
                while self.running:
                    self._generate_data()
                    time.sleep(5)  # Generate data every 5 seconds
                    
            except Exception as e:
                print(f"Simulator error: {e}")
            finally:
                if self.client:
                    self.client.disconnect()
                    
    def _generate_data(self):
        """Generate realistic sensor data"""
        current_time = datetime.utcnow()
        
        for device_config in self.devices:
            # Calculate time-based variations
            hour = current_time.hour
            minute = current_time.minute
            
            # Daily load pattern (higher during evening)
            daily_factor = self._daily_load_pattern(hour, minute)
            
            # 50/60Hz sinusoidal variation
            freq_factor = self._frequency_variation(current_time)
            
            # Occasional spikes
            spike_factor = self._spike_probability(current_time)
            
            if device_config["type"] == "power":
                base_value = device_config["base_power"]
                value = base_value * daily_factor * freq_factor * spike_factor
                
            elif device_config["type"] == "voltage":
                base_value = device_config["base_voltage"]
                value = base_value * (1 + 0.02 * freq_factor)  # Small voltage variation
                
            elif device_config["type"] == "temp":
                base_value = device_config["base_temp"]
                # Temperature varies slowly with some noise
                temp_variation = 2 * daily_factor + random.uniform(-1, 1)
                value = base_value + temp_variation
                
            elif device_config["type"] == "aqi":
                base_value = device_config["base_aqi"]
                # AQI has some randomness but generally stable
                aqi_noise = random.uniform(-5, 5)
                value = max(0, base_value + aqi_noise)
                
            else:
                continue
                
            # Publish to MQTT
            payload = {
                "ts": current_time.isoformat() + "Z",
                "site": device_config["site"],
                "device_name": device_config["name"],
                "type": device_config["type"],
                "unit": device_config["unit"],
                device_config["type"]: round(value, 2)
            }
            
            topic = f"sensor/{device_config['site']}/{device_config['name']}/reading"
            self.client.publish(topic, json.dumps(payload), qos=1)
            
            # Also store directly in database for immediate UI updates
            self._store_metric(device_config, current_time, value)
            
    def _daily_load_pattern(self, hour, minute):
        """Generate daily load pattern with higher usage in evening"""
        # Base pattern: low at night (0.3), medium during day (0.7), high in evening (1.2)
        if 22 <= hour or hour <= 6:
            base = 0.3
        elif 7 <= hour <= 17:
            base = 0.7
        else:
            base = 1.2
            
        # Add some randomness
        noise = random.uniform(0.9, 1.1)
        return base * noise
        
    def _frequency_variation(self, timestamp):
        """Generate 50/60Hz sinusoidal variation"""
        # Simulate 50Hz variation (European standard)
        frequency = 50
        phase = 2 * 3.14159 * frequency * timestamp.timestamp()
        return 1 + 0.05 * (1 + 0.5 * (timestamp.second % 10) / 10) * (1 + 0.1 * (timestamp.microsecond / 1000000))
        
    def _spike_probability(self, timestamp):
        """Generate occasional spikes (5% probability)"""
        if random.random() < 0.05:  # 5% chance of spike
            return random.uniform(1.5, 3.0)  # 1.5x to 3x normal value
        return 1.0
        
    def _store_metric(self, device_config, timestamp, value):
        """Store metric directly in database"""
        try:
            # Get or create site
            site = Site.query.filter_by(name=device_config["site"]).first()
            if not site:
                site = Site(name=device_config["site"], tz="America/Toronto")
                db.session.add(site)
                db.session.commit()
                
            # Get or create device
            device = Device.query.filter_by(
                name=device_config["name"], 
                site_id=site.id
            ).first()
            
            if not device:
                device = Device(
                    site_id=site.id,
                    name=device_config["name"],
                    type=device_config["type"],
                    unit=device_config["unit"],
                    capabilities=["realtime", "historical"]
                )
                db.session.add(device)
                db.session.commit()
                
            # Update last seen
            device.last_seen_at = timestamp
            
            # Store metric
            metric = Metric(
                ts=timestamp,
                device_id=device.id,
                key=device_config["type"],
                value=value
            )
            db.session.add(metric)
            db.session.commit()
            
        except Exception as e:
            print(f"Error storing metric: {e}")
            db.session.rollback()

# Global simulator instance
_simulator = None

def get_simulator():
    global _simulator
    return _simulator

def init_simulator(app, broker_host='localhost', broker_port=1883):
    global _simulator
    _simulator = DeterministicSimulator(app, broker_host, broker_port)
    return _simulator

def start_simulator():
    global _simulator
    if _simulator:
        _simulator.start()

def stop_simulator():
    global _simulator
    if _simulator:
        _simulator.stop()
