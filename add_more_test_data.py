#!/usr/bin/env python3
"""
Add more comprehensive test data to make the dashboard interesting
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.models import db, Device, Metric
import random
from datetime import datetime, timedelta
import math

def add_comprehensive_test_data():
    app = create_app()
    
    with app.app_context():
        # Get all devices
        devices = Device.query.all()
        if not devices:
            print("No devices found. Please ensure the database is initialized.")
            return
        
        print(f"Adding comprehensive test data for {len(devices)} devices...")
        
        # Add data for the last 24 hours
        base_time = datetime.utcnow() - timedelta(hours=24)
        
        for device in devices:
            print(f"Adding data for device: {device.name}")
            
            # Generate realistic data based on device type
            if device.type == 'power':
                # Generate realistic power consumption patterns
                for i in range(1440):  # 24 hours * 60 minutes
                    timestamp = base_time + timedelta(minutes=i)
                    
                    # Daily load pattern (higher during day, lower at night)
                    hour = timestamp.hour
                    daily_factor = 0.3 + 0.7 * (0.5 + 0.5 * math.sin((hour - 6) * math.pi / 12))
                    
                    # Base load with some variation
                    base_load = 800 + 400 * daily_factor
                    
                    # Add some random spikes and variations
                    noise = random.uniform(-100, 100)
                    spike_chance = random.random()
                    if spike_chance < 0.05:  # 5% chance of a spike
                        spike = random.uniform(500, 1000)
                        power_value = base_load + spike + noise
                    else:
                        power_value = base_load + noise
                    
                    # Ensure positive values
                    power_value = max(100, power_value)
                    
                    metric = Metric(
                        ts=timestamp,
                        device_id=device.id,
                        key='power',
                        value=power_value
                    )
                    db.session.add(metric)
                    
            elif device.type == 'voltage':
                # Generate voltage data (around 240V with small variations)
                for i in range(1440):
                    timestamp = base_time + timedelta(minutes=i)
                    
                    # Voltage varies slightly throughout the day
                    hour = timestamp.hour
                    voltage_variation = 2 * math.sin((hour - 6) * math.pi / 12)
                    voltage_value = 240 + voltage_variation + random.uniform(-3, 3)
                    
                    metric = Metric(
                        ts=timestamp,
                        device_id=device.id,
                        key='voltage',
                        value=voltage_value
                    )
                    db.session.add(metric)
                    
            elif device.type == 'temperature':
                # Generate temperature data
                for i in range(1440):
                    timestamp = base_time + timedelta(minutes=i)
                    
                    # Temperature varies throughout the day
                    hour = timestamp.hour
                    temp_variation = 8 * math.sin((hour - 6) * math.pi / 12)
                    temp_value = 22 + temp_variation + random.uniform(-2, 2)
                    
                    metric = Metric(
                        ts=timestamp,
                        device_id=device.id,
                        key='temp',
                        value=temp_value
                    )
                    db.session.add(metric)
        
        db.session.commit()
        print("Comprehensive test data added successfully!")
        print(f"Added 1440 data points per device for the last 24 hours")

if __name__ == "__main__":
    add_comprehensive_test_data()
