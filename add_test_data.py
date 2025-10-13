#!/usr/bin/env python3
"""
Simple script to add test data to the Wattboard database
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.models import db, Device, Metric
import random
from datetime import datetime, timedelta
import time

def add_test_data():
    app = create_app()
    
    with app.app_context():
        # Get the first device
        device = Device.query.first()
        if not device:
            print("No devices found. Please ensure the database is initialized.")
            return
        
        print(f"Adding test data for device: {device.name}")
        
        # Add some sample metrics
        base_time = datetime.utcnow() - timedelta(hours=1)
        
        for i in range(60):  # 60 data points over the last hour
            timestamp = base_time + timedelta(minutes=i)
            
            # Generate realistic power data (sine wave with some noise)
            base_power = 1000 + 500 * (1 + (i % 30) / 30)  # Varying base load
            noise = random.uniform(-50, 50)
            power_value = base_power + noise
            
            # Create metric entry
            metric = Metric(
                ts=timestamp,
                device_id=device.id,
                key='power',
                value=power_value
            )
            
            db.session.add(metric)
        
        # Also add some voltage data
        for i in range(60):
            timestamp = base_time + timedelta(minutes=i)
            
            # Generate voltage data (around 240V with small variations)
            voltage_value = 240 + random.uniform(-5, 5)
            
            metric = Metric(
                ts=timestamp,
                device_id=device.id,
                key='voltage',
                value=voltage_value
            )
            
            db.session.add(metric)
        
        db.session.commit()
        print("Test data added successfully!")
        print(f"Added 120 metrics (60 power + 60 voltage) for device {device.name}")

if __name__ == "__main__":
    add_test_data()
